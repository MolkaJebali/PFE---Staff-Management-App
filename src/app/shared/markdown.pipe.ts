import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    
    // Simple markdown to HTML conversion
    let html = value
      // Convert bold text **text** to <strong>text</strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert italic text *text* to <em>text</em>
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Convert headers ### text to <h3>text</h3>
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Convert bullet points • text to <li>text</li>
      .replace(/^• (.*$)/gm, '<li>$1</li>')
      // Wrap consecutive <li> elements in <ul>
      .replace(/(<li>.*<\/li>\s*)+/g, (match) => `<ul>${match}</ul>`)
      // Convert line breaks to <br>
      .replace(/\n/g, '<br>');
    
    return html;
  }
}
