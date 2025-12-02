// utils/DialogParser.js
export class DialogParser {
  constructor() {
    this.linkRegex = /<link\s+href=['"]([^'" ]+)['"](?:\s+color=['"]([^'" ]+)['"])?>(.*?)<\/link>/g;
  }

  parse(line) {
    const match = line.match(/^<(\w+)>/);
    
    if (match) {
      return {
        content: line.slice(match[0].length).trimStart(),
        tag: match[1]
      };
    }
    
    return {
      content: line,
      tag: null
    };
  }

  renderLinks(content) {
    return content.replace(
      this.linkRegex,
      (_, href, color = 'blue', text) => {
        return `<a target="_blank" href="${href}" class="link-${color}">${text}</a>`;
      }
    );
  }

  stripHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }
}