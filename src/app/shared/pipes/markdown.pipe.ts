import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    
    // Basic markdown transformations
    let html = value
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>')
      // Line breaks
      .replace(/\n/g, '<br>')
      // Bullet points
      .replace(/^• (.*$)/gim, '<li class="ml-4">$1</li>')
      // Wrap lists
      .replace(/(<li.*<\/li>)/s, '<ul class="list-disc ml-4">$1</ul>');
    
    return html;
  }
}
