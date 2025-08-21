/**
 * Graph visualization (TypeScript)
 */

export function showGraph(data: any) {

    // ForceGraph might be a global factory function provided by a bundled lib
    const Graph = (ForceGraph as any)()(document.getElementById('schema-graph'))
        .graphData(data)
        .nodeId('name')
        .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D) => {
            const nodeWidth = 160;
            const lineHeight = 14;
            const padding = 8;
            const headerHeight = 20;
            const fontSize = 12;
            const textColor = '#111';
            const fillColor = '#f6f6f6';
            const strokeColor = '#222';

            const boxHeight = headerHeight + (node.columns?.length || 0) * lineHeight + padding * 2;

            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.fillRect(node.x - nodeWidth / 2, node.y - boxHeight / 2, nodeWidth, boxHeight);
            ctx.strokeRect(node.x - nodeWidth / 2, node.y - boxHeight / 2, nodeWidth, boxHeight);

            ctx.fillStyle = textColor;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name, node.x, node.y - boxHeight / 2 + headerHeight / 2 + padding / 2);

            ctx.font = `${fontSize - 2}px Arial`;
            ctx.textAlign = 'left';
            const startX = node.x - nodeWidth / 2 + padding;
            let colY = node.y - boxHeight / 2 + headerHeight + padding;
            (node.columns || []).forEach((col: any) => {
                let name = col;
                let type = null;
                if (typeof col === 'object') {
                    name = col.name || '';
                    type = col.type || col.dataType || null;
                }

                ctx.textAlign = 'left';
                ctx.fillStyle = '#000';
                ctx.fillText(name, startX, colY);

                if (type) {
                    ctx.fillStyle = '#555';
                    const nameWidth = ctx.measureText(name).width;
                    const available = nodeWidth - padding * 2 - nameWidth - 8;
                    let typeText = String(type);
                    if (available > 0) {
                        if (ctx.measureText(typeText).width > available) {
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
        .linkCanvasObject((link: any, ctx: CanvasRenderingContext2D) => {
            const getEdgeColor = () => {
                try {
                    const root = getComputedStyle(document.documentElement);
                    const cssEdge = root.getPropertyValue('--edge-color');
                    if (cssEdge && cssEdge.trim()) return cssEdge.trim();

                    const bg = getComputedStyle(document.body).backgroundColor || '';
                    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
                    if (m) {
                        const r = parseInt(m[1], 10) / 255;
                        const g = parseInt(m[2], 10) / 255;
                        const b = parseInt(m[3], 10) / 255;
                        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                        return L > 0.6 ? '#111' : '#ffffff';
                    }
                } catch (e) {
                    // ignore
                }
                return '#ffffff';
            };

            const edgeColor = getEdgeColor();
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(link.source.x, link.source.y);
            ctx.lineTo(link.target.x, link.target.y);
            ctx.stroke();
        });

    if (typeof (window as any).d3 !== 'undefined' && typeof (window as any).d3.forceManyBody === 'function') {
        const d3 = (window as any).d3;
        Graph.d3Force('charge', d3.forceManyBody().strength(-900));
        Graph.d3Force('link', d3.forceLink().id((d: any) => d.name).distance(220).strength(0.9));

        if (typeof d3.forceCollide === 'function') {
            Graph.d3Force('collision', d3.forceCollide().radius(() => 90).strength(0.9));
        }
    }

    Graph.onEngineStop(() => {
        console.debug('Engine stopped, layout stabilized.');
    }).width(window.innerWidth).height(window.innerHeight);

    try {
        const computedBg = getComputedStyle(document.body).backgroundColor || '';
        const pickColor = (bg: string) => {
            try {
                const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
                if (m) {
                    const r = parseInt(m[1], 10) / 255;
                    const g = parseInt(m[2], 10) / 255;
                    const b = parseInt(m[3], 10) / 255;
                    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    return L > 0.6 ? '#111' : '#ffffff';
                }
            } catch (e) { /* empty */ }
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
