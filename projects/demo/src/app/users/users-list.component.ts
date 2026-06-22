import { Component, inject } from '@angular/core';
import { UsersService } from './users.service';

@Component({
  standalone: true,
  selector: 'app-users-list',
  template: `
    <div class="page-header">
      <h2>Users</h2>
    </div>

    @if (users.loading()) {
      <p class="status-loading">Fetching users…</p>
    }

    @if (users.error(); as err) {
      <p class="status-error">{{ err.message }}</p>
    }

    @for (user of users.data() ?? []; track user.id) {
      <div class="card user-card">
        <span class="user-name">{{ user.name }}</span>
        <span class="user-meta">{{ user.email }}</span>
        <span class="user-meta">{{ user.company.name }}</span>
      </div>
    }

    @if (users.data(); as list) {
      <p class="hint">{{ list.length }} users loaded</p>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
    h2 { margin: 0; }
    .user-card { display: flex; gap: 1.5rem; align-items: baseline; }
    .user-name { font-weight: 500; min-width: 180px; }
    .user-meta { font-size: 0.8rem; color: #6b7280; }
    .hint { font-size: 0.75rem; color: #9ca3af; margin-top: 1rem; }
  `],
})
export class UsersListComponent {
  protected readonly users = inject(UsersService).users;
}
