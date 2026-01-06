import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDatabase } from "@/contexts/DatabaseContext";
import { databaseService } from "@/services/database";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Sidebar from "@/components/layout/Sidebar";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, logout, user } = useAuth();
  const { selectedGraph } = useDatabase();
  const [githubStars, setGithubStars] = useState<string>('-');
  const [rules, setRules] = useState('');
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [initialRulesLoaded, setInitialRulesLoaded] = useState(false);
  const loadedRulesRef = useRef<string>(''); // Track the originally loaded rules
  const currentRulesRef = useRef<string>(''); // Track the current rules value
  const currentGraphIdRef = useRef<string | null>(null); // Track current database ID for unmount save
  const useRulesFromDatabaseRef = useRef<boolean>(true); // Track toggle state for unmount
  const initialRulesLoadedRef = useRef<boolean>(false); // Track loaded state for unmount
  const [useMemory, setUseMemory] = useState(() => {
    // Load from localStorage on init, default to true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('queryweaver_use_memory');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });
  const [useRulesFromDatabase, setUseRulesFromDatabase] = useState(() => {
    // Load from localStorage on init, default to true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('queryweaver_use_rules_from_database');
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  // Fetch GitHub stars
  useEffect(() => {
    fetch('https://api.github.com/repos/FalkorDB/QueryWeaver')
      .then(response => response.json())
      .then(data => {
        if (typeof data.stargazers_count === 'number') {
          setGithubStars(data.stargazers_count.toLocaleString());
        }
      })
      .catch(error => {
        console.log('Failed to fetch GitHub stars:', error);
      });
  }, []);

  // Fetch user rules from backend when component mounts or database changes (only if using database rules)
  useEffect(() => {
    const loadRules = async () => {
      if (!selectedGraph) {
        setRules('');
        setIsLoadingRules(false);
        setInitialRulesLoaded(false);
        loadedRulesRef.current = '';
        currentGraphIdRef.current = null;
        return;
      }
      
      // Update the ref to track current database
      currentGraphIdRef.current = selectedGraph.id;
      
      // Only fetch from database if toggle is enabled
      if (!useRulesFromDatabase) {
        setIsLoadingRules(false);
        setInitialRulesLoaded(true);
        return;
      }
      
      try {
        setIsLoadingRules(true);
        setInitialRulesLoaded(false);
        const userRules = await databaseService.getUserRules(selectedGraph.id);
        const rulesValue = userRules || '';
        setRules(rulesValue);
        loadedRulesRef.current = rulesValue; // Store the loaded value
      } catch (error) {
        console.error('Failed to load user rules:', error);
        toast({
          title: "Error",
          description: "Failed to load user rules from database",
          variant: "destructive",
        });
      } finally {
        setIsLoadingRules(false);
        setInitialRulesLoaded(true);
        initialRulesLoadedRef.current = true;
      }
    };
    
    loadRules();
  }, [selectedGraph?.id, toast, useRulesFromDatabase]);

  // Update refs when toggle or rules change
  useEffect(() => {
    useRulesFromDatabaseRef.current = useRulesFromDatabase;
  }, [useRulesFromDatabase]);

  useEffect(() => {
    currentRulesRef.current = rules;
  }, [rules]);

  // Save rules when component unmounts (user navigates away from Settings)
  useEffect(() => {
    return () => {
      // At unmount time, check if there are unsaved changes and save them
      const graphId = currentGraphIdRef.current;
      const loadedRules = loadedRulesRef.current;
      const currentRules = currentRulesRef.current;
      const shouldUseDb = useRulesFromDatabaseRef.current;
      const isLoaded = initialRulesLoadedRef.current;
      
      if (graphId && shouldUseDb && currentRules !== loadedRules && isLoaded) {
        // Save immediately on unmount if there are unsaved changes
        console.log('Saving rules on unmount...', { graphId, length: currentRules.length });
        databaseService.updateUserRules(graphId, currentRules)
          .then(() => console.log('User rules saved on unmount to:', graphId))
          .catch(err => console.error('Failed to save rules on unmount:', err));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - effect runs once on mount, cleanup runs once on unmount

  // Auto-save to localStorage whenever useMemory changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('queryweaver_use_memory', String(useMemory));
    }
  }, [useMemory]);

  // Auto-save to localStorage whenever useRulesFromDatabase changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('queryweaver_use_rules_from_database', String(useRulesFromDatabase));
    }
  }, [useRulesFromDatabase]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
      window.location.reload();
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: error instanceof Error ? error.message : "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const handleBackClick = async () => {
    // Save rules before navigating away if there are unsaved changes
    const graphId = currentGraphIdRef.current;
    const loadedRules = loadedRulesRef.current;
    const currentRules = currentRulesRef.current;
    
    if (graphId && useRulesFromDatabase && currentRules !== loadedRules && initialRulesLoaded) {
      try {
        console.log('Saving rules before navigation...', { graphId, length: currentRules.length });
        await databaseService.updateUserRules(graphId, currentRules);
        loadedRulesRef.current = currentRules; // Update to prevent unmount from saving again
        console.log('User rules saved successfully');
      } catch (error) {
        console.error('Failed to save rules:', error);
        toast({
          title: "Error",
          description: "Failed to save user rules",
          variant: "destructive",
        });
      }
    }
    
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar 
        onSchemaClick={() => {}}
        isSchemaOpen={false}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        onSettingsClick={() => {}}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-16">
        {/* Top Header Bar */}
        <header className="border-b border-gray-700 bg-gray-900">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/icons/queryweaver.svg" alt="QueryWeaver" style={{ height: '3rem', width: 'auto' }} />
                <span className="text-gray-400">|</span>
                <p className="text-sm text-gray-400">Graph-Powered Text-to-SQL</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedGraph ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  Connected: {selectedGraph.name}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-600 hover:bg-yellow-700">
                  No Database Selected
                </Badge>
              )}
              {/* GitHub Stars Link */}
              <a
                href="https://github.com/FalkorDB/QueryWeaver"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
                title="View QueryWeaver on GitHub"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                <Star className="w-3 h-3" fill="currentColor" />
                <span className="text-sm font-medium">{githubStars}</span>
              </a>
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="p-0 h-auto rounded-full hover:opacity-80 transition-opacity"
                      title={user?.name || user?.email}
                    >
                      <Avatar className="h-10 w-10 border-2 border-purple-500">
                        <AvatarImage src={user?.picture} alt={user?.name || user?.email} />
                        <AvatarFallback className="bg-purple-600 text-white font-medium">
                          {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-gray-800 border-gray-600 text-gray-200" align="end">
                    <div className="px-3 py-2 border-b border-gray-600">
                      <p className="text-sm font-medium text-gray-100">{user?.name}</p>
                      <p className="text-xs text-gray-400">{user?.email}</p>
                    </div>
                    <DropdownMenuItem className="hover:!bg-gray-700 cursor-pointer">
                      API Tokens
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-600" />
                    <DropdownMenuItem className="hover:!bg-gray-700 cursor-pointer" onClick={handleLogout}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  className="bg-purple-600 border-purple-500 text-white hover:bg-purple-700"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Settings Header */}
        <div className="border-b border-gray-600 bg-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackClick}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">Query Settings</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Define custom rules and specifications for SQL generation. Changes are saved automatically.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Memory Toggle */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="use-memory" className="text-base font-semibold text-gray-200">
                    Use Memory Context
                  </Label>
                  <p className="text-sm text-gray-400">
                    Enable AI to remember previous interactions, preferences, and query patterns for more personalized results
                  </p>
                </div>
                <Switch
                  id="use-memory"
                  checked={useMemory}
                  onCheckedChange={setUseMemory}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>
            </div>

            {/* Database Rules Toggle */}
            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="use-database-rules" className="text-base font-semibold text-gray-200">
                    Use Database Rules
                  </Label>
                  <p className="text-sm text-gray-400">
                    Store rules in the database and use for all sessions. When disabled, rules are sent with each request
                  </p>
                </div>
                <Switch
                  id="use-database-rules"
                  checked={useRulesFromDatabase}
                  onCheckedChange={setUseRulesFromDatabase}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>
            </div>

            {/* User Rules - only show when database rules are enabled */}
            {useRulesFromDatabase && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rules" className="text-base font-semibold text-gray-200">
                    User Rules & Specifications
                  </Label>
                  <span className="text-xs text-gray-500">
                    {rules.length}/5000 characters
                  </span>
                </div>
              <Textarea
                id="rules"
                placeholder={`Example rules:
- Always use ISO date format (YYYY-MM-DD)
- Limit results to 100 rows unless specified
- Always include ORDER BY for consistent results
- Use LEFT JOIN instead of INNER JOIN for optional relationships
- Add comments to complex queries
- Prefer explicit column names over SELECT *
- Use descriptive aliases for clarity`}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                maxLength={5000}
                className="min-h-[400px] bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500 font-mono text-sm"
              />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
