import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  authService: any;
  isMobileMenuOpen = false;
  isFeaturesDropdownOpen = false;

  constructor(private router: Router) {}

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  toggleFeaturesDropdown(event: Event): void {
    event.preventDefault();
    this.isFeaturesDropdownOpen = !this.isFeaturesDropdownOpen;
  }

  navigateTo(route: string, event?: Event): void {
    if (event) event.preventDefault();
    this.isFeaturesDropdownOpen = false;
    this.router.navigate([route]);
  }

  logout(): void {
    if (this.authService) {
      this.authService.logout();
    }
    this.router.navigate(['']);
  }
}
