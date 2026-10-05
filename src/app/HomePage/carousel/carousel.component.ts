import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

interface Slide {
  image: string;
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  alt: string;
}

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.css']
})
export class CarouselComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  private intervalSubscription!: Subscription;
  isPaused = false;

  
  ngOnInit() {
   // this.startCarousel();
  }

  ngOnDestroy() {
   // this.stopCarousel();
  }

  

  



 
}

