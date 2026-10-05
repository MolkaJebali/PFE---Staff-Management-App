import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-body',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './body.component.html',
  styleUrls: ['./body.component.css']
})
export class BodyComponent {
  refreshIframe() {
    const iframe = document.querySelector('.iframe-container iframe') as HTMLIFrameElement;
    if (iframe) iframe.src = iframe.src;
  }
  
  printPage() {
    window.print();
  }
  
  }

