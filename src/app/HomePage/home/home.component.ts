import { AfterViewInit, Component, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { CarouselComponent } from '../carousel/carousel.component';
import { FeaturesComponent } from '../features/features.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-home',
  standalone: true, 
  imports: [NavbarComponent, CarouselComponent, FeaturesComponent, FooterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements AfterViewInit {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}
  
  async ngAfterViewInit() {
    // Only initialize Flowbite in browser environment
    if (isPlatformBrowser(this.platformId)) {
      try {
        const flowbite = await import('flowbite');
        flowbite.initDropdowns();
      } catch (error) {
        console.error('Error initializing Flowbite:', error);
      }
    }
  }
}
