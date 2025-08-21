    
export function showGraph(data) {

    const Graph = ForceGraph()(document.getElementById('schema-graph'))
        .graphData(data)
        .nodeId('name')
        // Custom node renderer: draw table-like boxes with columns
        .nodeCanvasObject((node, ctx, globalScale) => {
            const nodeWidth = 160;
            const lineHeight = 14;
            const padding = 8;
            const headerHeight = 20;
            const fontSize = 12;
            const textColor = '#111';
            const fillColor = '#f6f6f6';
            const strokeColor = '#222';

            // compute box height from number of columns
            const boxHeight = headerHeight + node.columns.length * lineHeight + padding * 2;

            // Draw the box
            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.fillRect(node.x - nodeWidth / 2, node.y - boxHeight / 2, nodeWidth, boxHeight);
            ctx.strokeRect(node.x - nodeWidth / 2, node.y - boxHeight / 2, nodeWidth, boxHeight);

            // Table name (centered in header area)
            ctx.fillStyle = textColor;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name, node.x, node.y - boxHeight / 2 + headerHeight / 2 + padding / 2);

            // Columns list (left aligned)
            ctx.font = `${fontSize - 2}px Arial`;
            ctx.textAlign = 'left';
            const startX = node.x - nodeWidth / 2 + padding;
            let colY = node.y - boxHeight / 2 + headerHeight + padding;
                node.columns.forEach((col) => {
                    let name = col;
                    let type = null;
                    if (typeof col === 'object') {
                        name = col.name || '';
                        type = col.type || col.dataType || null;
                    }

                    // draw column name left-aligned
                    ctx.textAlign = 'left';
                    ctx.fillStyle = '#000';
                    ctx.fillText(name, startX, colY);

                    // draw type right-aligned in lighter color, truncated if necessary
                    if (type) {
                        ctx.fillStyle = '#555';
                        // compute available width for the type text so it doesn't overlap the column name
                        const nameWidth = ctx.measureText(name).width;
                        const available = nodeWidth - padding * 2 - nameWidth - 8; // 8px gap
                        let typeText = String(type);
                        if (available > 0) {
                            if (ctx.measureText(typeText).width > available) {
                                // truncate and add ellipsis until it fits
                                while (typeText.length > 0 && ctx.measureText(typeText + '…').width > available) {
                                    typeText = typeText.slice(0, -1);
                                }
                                typeText = typeText + '…';
                            }
                            ctx.textAlign = 'right';
                            ctx.fillText(typeText, node.x + nodeWidth / 2 - padding, colY);
                        }
                        ctx.fillStyle = '#000';
                        ctx.textAlign = 'left';
                    }

                    colY += lineHeight;
            });
        })
        // Draw links as lines behind nodes (color adapts to current theme/background)
        .linkCanvasObject((link, ctx) => {
            const getEdgeColor = () => {
                try {
                    const root = getComputedStyle(document.documentElement);
                    // Prefer explicit CSS variable if present
                    const cssEdge = root.getPropertyValue('--edge-color');
                    if (cssEdge && cssEdge.trim()) return cssEdge.trim();

                    // Fallback: compute from body background luminance
                    const bg = getComputedStyle(document.body).backgroundColor || '';
                    // parse rgb(a) strings like 'rgb(r, g, b)' or 'rgba(r,g,b,a)'
                    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
                    if (m) {
                        const r = parseInt(m[1], 10) / 255;
                        const g = parseInt(m[2], 10) / 255;
                        const b = parseInt(m[3], 10) / 255;
                        // sRGB luminance
                        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                        // if background is light, use dark edges; otherwise use light edges
                        return L > 0.6 ? '#111' : '#ffffff';
                    }
                } catch (e) {
                    // ignore
                }
                // final fallback
                return '#ffffff';
            };

            const edgeColor = getEdgeColor();
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(link.source.x, link.source.y);
            ctx.lineTo(link.target.x, link.target.y);
            ctx.stroke();
        })
        // Note: avoid chaining .d3Force(...) getters because they return the force object
        // instead, set forces below using .d3Force(name, force) when d3 is available.
        ;

    // Configure forces using d3 if available, otherwise leave defaults
    if (typeof d3 !== 'undefined' && typeof d3.forceManyBody === 'function') {
        Graph.d3Force('charge', d3.forceManyBody().strength(-900));
        Graph.d3Force('link', d3.forceLink().id(d => d.name).distance(220).strength(0.9));

        // Add collision force to avoid overlap when available
        if (typeof d3.forceCollide === 'function') {
            Graph.d3Force('collision', d3.forceCollide().radius(() => 90).strength(0.9));
        }
    } else {
        // Fallback: if d3 not available, slightly adjust directional link arrows only.
        // ForceGraph will use its default forces in this case.
    }

    // Stop when layout stabilizes and set canvas size
    Graph.onEngineStop(() => {
        console.debug('Engine stopped, layout stabilized.');
    }).width(window.innerWidth).height(window.innerHeight);

    // Optional: add directional arrows on links to make edges clearer
    // ensure link color matches canvas-drawn edges
    try {
        const computedBg = getComputedStyle(document.body).backgroundColor || '';
        const pickColor = (bg) => {
            try {
                const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
                if (m) {
                    const r = parseInt(m[1], 10) / 255;
                    const g = parseInt(m[2], 10) / 255;
                    const b = parseInt(m[3], 10) / 255;
                    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    return L > 0.6 ? '#111' : '#ffffff';
                }
            } catch (e) {}
            return '#ffffff';
        };
        const edgeColor = (() => {
            const root = getComputedStyle(document.documentElement);
            const cssEdge = root.getPropertyValue('--edge-color');
            if (cssEdge && cssEdge.trim()) return cssEdge.trim();
            return pickColor(computedBg);
        })();

        Graph.linkColor(() => edgeColor)
             .linkDirectionalArrowLength(6).linkDirectionalArrowRelPos(1);
    } catch (e) {
        Graph.linkDirectionalArrowLength(6).linkDirectionalArrowRelPos(1);
    }
}