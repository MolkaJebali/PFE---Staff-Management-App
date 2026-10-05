import { Component } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { BodyComponent } from '../body/body.component';
import { FooterComponent } from '../footer/footer.component';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [HeaderComponent ,BodyComponent , FooterComponent  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {

}
