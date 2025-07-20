import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { LoggerService } from '../../../core/services/logger.service';
import { take } from 'rxjs';

interface UnauthorizedQueryParams {
  requiredRole?: string;
  currentUrl?: string;
  reason?: string;
}

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.scss'],
})
export class UnauthorizedComponent implements OnInit {
  requiredRole: string | null = null;
  currentUrl: string | null = null;
  reason: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe((params: UnauthorizedQueryParams) => {
      this.requiredRole = params.requiredRole || null;
      this.currentUrl = params.currentUrl || null;
      this.reason = params.reason || null;
      this.logger.warn(
        `Unauthorized access attempt. Required Role: ${this.requiredRole}, Current URL: ${this.currentUrl}, Reason: ${this.reason}`,
      );
    });
  }

  goBack(): void {
    if (this.currentUrl && this.currentUrl !== '/unauthorized') {
      void this.router.navigateByUrl(this.currentUrl);
    } else {
      void this.router.navigate(['/']); // Navigate to home or a safe default
    }
  }
}
