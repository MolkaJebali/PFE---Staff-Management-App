import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerSuiviComponent } from './manager-suivi.component';

describe('ManagerSuiviComponent', () => {
  let component: ManagerSuiviComponent;
  let fixture: ComponentFixture<ManagerSuiviComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerSuiviComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagerSuiviComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
