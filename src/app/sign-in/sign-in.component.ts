import { UserService } from '../user.service';
import { Component,OnInit } from '@angular/core';
import { FormBuilder, FormGroup, NgForm, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms'; // Importer ReactiveFormsModule
import { NgIf } from '@angular/common';
@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [ReactiveFormsModule,NgIf,],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css'
})
export class SignInComponent {
  signInForm!: FormGroup;

  constructor(private fb: FormBuilder, private userService: UserService) {}

  ngOnInit(): void {
    this.signInForm = this.fb.group({
      firstname: ['', Validators.required],
      lastname: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('[0-9]{8}')]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      code: ['', Validators.required] // Ajout du champ code ici
    });
  }

  onSubmit(): void {
    if (this.signInForm.valid) {
      this.userService.signIn(this.signInForm).subscribe({
        next: (res) => alert(res),
        error: (err) => alert('Erreur lors de l’inscription : ' + err.error)
      });
    } else {
      alert('Formulaire invalide');
    }
  }
}