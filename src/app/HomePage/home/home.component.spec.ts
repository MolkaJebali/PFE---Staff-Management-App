import { Component, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initDropdowns } from 'flowbite';
import { NavbarComponent } from "../navbar/navbar.component";
import { CarouselComponent } from "../carousel/carousel.component";
import { FeaturesComponent } from '../features/features.component';
import { FooterComponent } from "../footer/footer.component";
@Component({
  selector: 'app-home',
  standalone:true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  imports: [NavbarComponent, CarouselComponent, FeaturesComponent, FooterComponent]
})
export class HomeComponent implements AfterViewInit {

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit(): void {
    // Ne lance Flowbite que dans le navigateur, pas sur le serveur
    if (isPlatformBrowser(this.platformId)) {
      initDropdowns();
    }
  }
}
  