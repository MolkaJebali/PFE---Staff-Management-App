import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule, NgIf, isPlatformBrowser } from '@angular/common';
import { UserService } from '../user.service';

import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { TokenInterceptor } from '../interceptors/token.interceptor';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIf, HttpClientModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true
    }
  ],
})
export class LoginComponent {
  loginForm: FormGroup;

  constructor(private fb: FormBuilder, private router: Router, private service: UserService, @Inject(PLATFORM_ID) private platformId: Object) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  // Méthode pour soumettre le formulaire
  onLogin(): void {
    if (this.loginForm.valid) {
      this.service.login(this.loginForm.value).subscribe({
        next: (response: any) => {
          console.log('Login response:', response);
          console.log('Type of response:', typeof response);
  
          // 🔧 Parser la chaîne JSON en objet
          if (typeof response === 'string') {
            try {
              response = JSON.parse(response);
            } catch (e) {
              console.error('Erreur de parsing JSON', e);
              alert('Erreur de format de réponse.');
              return;
            }
          }
  
          // Sauvegarde (only in browser)
          if (isPlatformBrowser(this.platformId)) {
            // Store email consistently
            localStorage.setItem('userEmail', this.loginForm.value.email);
            localStorage.setItem('userId', response.id);
            localStorage.setItem('token', response.jwt);
            localStorage.setItem('role', response.role);
            
            // After login, fetch user information to get full name
            this.service.getUserByEmail(this.loginForm.value.email).subscribe({
              next: (userInfo) => {
                const fullName = `${userInfo.firstname} ${userInfo.lastname}`;
                localStorage.setItem('userName', fullName);
                localStorage.setItem('userFullName', fullName); // Add additional key for consistency
                
                // Continue with navigation
                const role = response.role?.trim().toUpperCase();
                console.log('Parsed role:', role);
        
                if (role === 'MANAGER') {
                  this.router.navigate(['/manager-home']);
                } else if (role === 'EMPLOYE') {
                  this.router.navigate(['/employee-home']);
                } else {
                  alert('Rôle inconnu : ' + role);
                }
              },
              error: (err) => {
                console.error('Error fetching user details', err);
                // Continue with navigation even if we couldn't get the name
                const role = response.role?.trim().toUpperCase();
                if (role === 'MANAGER') {
                  this.router.navigate(['/manager-home']);
                } else if (role === 'EMPLOYE') {
                  this.router.navigate(['/employee-home']);
                } else {
                  alert('Rôle inconnu : ' + role);
                }
              }
            });
          }
        },
        error: (error) => {
          console.error('Login error:', error);
          if (error.status === 401) {
            alert('Identifiants invalides.');
          } else {
            alert('Erreur serveur.');
          }
        }
      });
    } else {
      console.log('Form is invalid');
    }
  }
  
   
}
