import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagerSheetComponent } from './manager-sheet.component';

describe('ManagerSheetComponent', () => {
  let component: ManagerSheetComponent;
  let fixture: ComponentFixture<ManagerSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerSheetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagerSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
