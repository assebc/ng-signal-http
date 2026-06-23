import { Component, signal } from '@angular/core';
import { querySignal } from '@assebc/ng-signal-http';
import { User } from '../models';

@Component({
  standalone: true,
  selector: 'app-user-detail',
  template: `
    <h2>User Detail</h2>
    <p class="hint">
      Changing the ID triggers a new <code>querySignal</code> fetch automatically.
      The previous in-flight request is cancelled.
    </p>

    <div class="id-selector">
      <button class="btn-secondary" (click)="prevUser()" [disabled]="userId() <= 1">◀ Prev</button>
      <span class="user-id">User #{{ userId() }}</span>
      <button class="btn-secondary" (click)="nextUser()" [disabled]="userId() >= 10">Next ▶</button>
    </div>

    @if (user.loading()) {
      <p class="status-loading">Fetching user #{{ userId() }}…</p>
    }

    @if (user.error(); as err) {
      <p class="status-error">{{ err.message }}</p>
    }

    @if (user.data(); as u) {
      <div class="card detail-card">
        <div class="row"><span class="label">Name</span><span>{{ u.name }}</span></div>
        <div class="row"><span class="label">Email</span><span>{{ u.email }}</span></div>
        <div class="row"><span class="label">Phone</span><span>{{ u.phone }}</span></div>
        <div class="row"><span class="label">Website</span><span>{{ u.website }}</span></div>
        <div class="row"><span class="label">Company</span><span>{{ u.company.name }}</span></div>
        <div class="row"><span class="label">City</span><span>{{ u.address.city }}</span></div>
      </div>
    }
  `,
  styles: [`
    h2 { margin-bottom: 0.25rem; }
    .id-selector { display: flex; align-items: center; gap: 1rem; margin: 1.25rem 0; }
    .user-id { font-size: 1.1rem; font-weight: 600; min-width: 80px; text-align: center; }
    .detail-card { display: grid; gap: 0.625rem; }
    .row { display: flex; gap: 1rem; }
    .label { color: #6b7280; font-size: 0.875rem; min-width: 72px; }
    .hint { font-size: 0.75rem; color: #9ca3af; margin-bottom: 0; }
  `],
})
export class UserDetailComponent {
  readonly userId = signal(1);
  readonly user = querySignal<User>(() => `/users/${this.userId()}`);

  prevUser() { this.userId.update(id => Math.max(1, id - 1)); }
  nextUser() { this.userId.update(id => Math.min(10, id + 1)); }
}
