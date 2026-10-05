import { Directive, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { Router } from '@angular/router';

@Directive({
  selector: 'a[appLink]',
  standalone: true
})
export class AppLinkDirective implements OnInit {
  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private router: Router
  ) {}

  ngOnInit() {
    const element = this.el.nativeElement;
    const href = element.getAttribute('href');
    
    // Only process internal app links
    if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('#')) {
      // Remove href attribute
      this.renderer.removeAttribute(element, 'href');
      
      // Add route handling
      this.renderer.listen(element, 'click', (event) => {
        event.preventDefault();
        
        // Navigate to the route
        const route = href.startsWith('/') ? href : `/${href}`;
        this.router.navigateByUrl(route);
      });
    }
  }
}
