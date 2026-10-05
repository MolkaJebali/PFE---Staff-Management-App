import { Routes } from '@angular/router';
import { SignInComponent } from './sign-in/sign-in.component';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './HomePage/home/home.component';
import { DashboardComponent } from './DashboardPage/dashboard/dashboard.component';
import { ContactComponent } from './contact/contact.component';
import { EmployeeComponent } from './employee/employee.component';
import { ManagerSuiviComponent } from './manager-suivi/manager-suivi.component';
import { ManagerSheetComponent } from './manager-sheet/manager-sheet.component';
import { EmployeeHomeComponent } from './employee-home/employee-home.component';
import { AssistantManagerComponent } from './assistant-manager/assistant-manager.component';

export const routes: Routes = [
    {
        path:"manager-home",
        component: HomeComponent,
    }, {
    path:"signin",
    component: SignInComponent,
},
{
    path:"",
    component: LoginComponent,
},
{
    path:"dashboard",
    component: DashboardComponent,
},
{
    path:"contact",
    component: ContactComponent,
},
{
    path:"employee",
    component: EmployeeComponent,
},
{
    path:"manager-suivi",
    component: ManagerSuiviComponent,
},
{
    path:"manager-sheet",
    component: ManagerSheetComponent,
},
{
    path:"employee-home",
    component: EmployeeHomeComponent,
},
{
    path:"assistant-manager",
    component: AssistantManagerComponent,
},
{
    path: '**',
    redirectTo: '/'
}
];
