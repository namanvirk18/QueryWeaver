import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

interface SuggestionCardsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

const SuggestionCards = ({ suggestions, onSelect }: SuggestionCardsProps) => {
  const isMobile = useIsMobile();
  
  return (
    <div className={`grid gap-4 mb-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
      {suggestions.map((suggestion, index) => (
        <Card
          key={index}
          className="bg-gray-800 border-gray-600 hover:border-purple-500/50 transition-all duration-200 cursor-pointer"
          onClick={() => onSelect(suggestion)}
        >
          <CardContent className="p-4">
            <div className="text-gray-300 text-sm text-center">
              {suggestion}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SuggestionCards;
