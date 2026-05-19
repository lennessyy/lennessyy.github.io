import { visit } from 'unist-util-visit';

export default function rehypeNarrativeBreaks() {
  return (tree, file) => {
    const isNarrative = file.data.astro?.frontmatter?.narrative;
    if (!isNarrative) return;

    const ops = [];

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'hr' && parent) {
        ops.push({ index, parent });
      }
    });

    for (let i = ops.length - 1; i >= 0; i--) {
      const { index, parent } = ops[i];
      const sectionNumber = i + 1;
      const children = parent.children;
      let epigraph = null;
      let epigraphIndex = -1;

      for (let j = index + 1; j < children.length; j++) {
        const sibling = children[j];
        if (sibling.type === 'text' && sibling.value.trim() === '') continue;
        if (sibling.type === 'element' && sibling.tagName === 'blockquote') {
          epigraph = sibling;
          epigraphIndex = j;
        }
        break;
      }

      if (epigraph) {
        epigraph.properties = epigraph.properties || {};
        epigraph.properties.className = ['narrative-epigraph'];
        children.splice(epigraphIndex, 1);
      }

      const lineNode = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['narrative-break-line'] },
        children: [],
      };

      const numberNode = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['narrative-break'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['narrative-break-number'] },
            children: [{ type: 'text', value: String(sectionNumber) }],
          },
          lineNode,
        ],
      };

      if (epigraph) {
        numberNode.children.push(epigraph);
      }

      children[index] = numberNode;
    }
  };
}
