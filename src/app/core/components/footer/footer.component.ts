import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

import { MaterialModule } from '../../../shared/material/material.module';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule, TranslocoModule],
})
export class FooterComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
