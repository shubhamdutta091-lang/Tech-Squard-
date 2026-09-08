/**
 * MOON VR: "THE LAST SIGNAL" - Mission Memory Causal Graph Visualizer
 * Core USP: "Your mission was not scripted. It remembered you."
 * Renders an interactive causal node graph tracing how early behavior
 * cascaded into late-stage emergencies.
 */

class MemoryGraphVisualizer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.selectedNodeId = null;
  }

  render(memoryNodes, rootVerdict) {
    if (!this.container) return;
    this.container.innerHTML = "";

    // Header Callout
    const header = document.createElement("div");
    header.className = "memory-graph-header";
    header.innerHTML = `
      <div class="graph-tagline">CAUSAL TIMELINE DECONSTRUCTION</div>
      <h3 class="graph-quote">“YOUR MISSION WAS NOT SCRIPTED. IT REMEMBERED YOU.”</h3>
      <p class="graph-verdict">${rootVerdict}</p>
    `;
    this.container.appendChild(header);

    // Main Graph Visual Area
    const graphWrapper = document.createElement("div");
    graphWrapper.className = "graph-tree-container";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "graph-connector-svg");
    graphWrapper.appendChild(svg);

    const nodesColumn = document.createElement("div");
    nodesColumn.className = "graph-nodes-list";

    memoryNodes.forEach((node, index) => {
      const nodeEl = document.createElement("div");
      nodeEl.className = `memory-node ${node.isFailureRoot ? "root-failure" : "nominal-node"}`;
      nodeEl.id = `node-${node.id}`;

      nodeEl.innerHTML = `
        <div class="node-badge">PHASE ${node.phase}</div>
        <div class="node-main">
          <div class="node-title">${node.title}</div>
          <div class="node-action"><strong>Action:</strong> ${node.actionTaken}</div>
          <div class="node-consequence"><strong>Downstream Impact:</strong> ${node.consequence}</div>
        </div>
        <div class="node-status-indicator">
          ${node.isFailureRoot ? "⚠️ ROOT CAUSE" : "✓ ADAPTED"}
        </div>
      `;

      nodeEl.addEventListener("click", () => this.selectNode(node, nodeEl));
      nodesColumn.appendChild(nodeEl);

      // Add causal connector arrow if not last node
      if (index < memoryNodes.length - 1) {
        const arrow = document.createElement("div");
        arrow.className = `causal-arrow ${node.isFailureRoot ? "arrow-critical" : ""}`;
        arrow.innerHTML = `
          <div class="arrow-line"></div>
          <div class="arrow-text">↳ INFLUENCED PHASE ${memoryNodes[index+1].phase}</div>
          <div class="arrow-point">▼</div>
        `;
        nodesColumn.appendChild(arrow);
      }
    });

    graphWrapper.appendChild(nodesColumn);

    // Node Detail Inspection Drawer
    const detailPanel = document.createElement("div");
    detailPanel.id = "memory-node-detail";
    detailPanel.className = "memory-detail-panel";
    detailPanel.innerHTML = `
      <div class="detail-placeholder">Click any mission memory node above to inspect the AI's internal behavioral log and causal link.</div>
    `;
    graphWrapper.appendChild(detailPanel);

    this.container.appendChild(graphWrapper);

    // Select the first root cause failure or first node by default
    const defaultNode = memoryNodes.find(n => n.isFailureRoot) || memoryNodes[0];
    if (defaultNode) {
      const el = document.getElementById(`node-${defaultNode.id}`);
      if (el) this.selectNode(defaultNode, el);
    }
  }

  selectNode(node, element) {
    document.querySelectorAll(".memory-node").forEach(el => el.classList.remove("selected"));
    element.classList.add("selected");
    this.selectedNodeId = node.id;

    const detailPanel = document.getElementById("memory-node-detail");
    if (!detailPanel) return;

    detailPanel.innerHTML = `
      <div class="detail-header">
        <span class="detail-phase-tag">PHASE ${node.phase} EVENT TELEMETRY</span>
        <span class="detail-id">MEMORY ID: ${node.id.toUpperCase()}</span>
      </div>
      <h4 class="detail-title">${node.title}</h4>
      <div class="detail-section">
        <div class="detail-label">OBSERVED BEHAVIOR</div>
        <div class="detail-value">${node.description}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">PLAYER INTERACTION</div>
        <div class="detail-value highlight-action">${node.actionTaken}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">AI MISSION DIRECTOR CAUSAL INFERENCE</div>
        <div class="detail-value highlight-consequence">${node.consequence}</div>
      </div>
      <div class="detail-footer">
        <span class="impact-badge ${node.isFailureRoot ? 'critical-impact' : 'stable-impact'}">
          ${node.isFailureRoot ? 'CASCADE HAZARD SEED' : 'SYSTEM BALANCED'}
        </span>
        <span class="downstream-info">Propagated to Phase ${node.downstreamPhase} Mission State</span>
      </div>
    `;
  }
}

window.MemoryGraphVisualizer = MemoryGraphVisualizer;
