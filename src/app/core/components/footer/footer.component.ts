import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../shared/material/material.module';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule, TranslocoModule]
})
export class FooterComponent implements OnInit {
  currentYear: number = new Date().getFullYear();

  constructor() {}

  ngOnInit(): void {}
}
