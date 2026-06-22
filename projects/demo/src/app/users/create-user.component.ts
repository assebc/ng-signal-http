import { Component, signal } from '@angular/core';
import { mutationSignal } from 'ng-signal-http';
import { CreateUserBody, User } from '../models';

@Component({
  standalone: true,
  selector: 'app-create-user',
  template: `
    <h2>Create User</h2>
    <p class="hint">Calls <code>mutationSignal</code> — JSONPlaceholder returns a fake created user.</p>

    <form class="form" (submit)="submit($event)">
      <div class="field">
        <label for="name">Name</label>
        <input
          id="name"
          type="text"
          [value]="name()"
          (input)="name.set($any($event).target.value)"
          placeholder="Alice Smith"
        />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          [value]="email()"
          (input)="email.set($any($event).target.value)"
          placeholder="alice@example.com"
        />
      </div>

      <div class="actions">
        <button class="btn-primary" type="submit" [disabled]="mutation.isPending() || !name() || !email()">
          {{ mutation.isPending() ? 'Creating…' : 'Create User' }}
        </button>
        @if (mutation.data() || mutation.error()) {
          <button class="btn-secondary" type="button" (click)="mutation.reset()">Reset</button>
        }
      </div>
    </form>

    @if (mutation.data(); as u) {
      <div class="status-success">
        <strong>Created!</strong> Server assigned ID <code>{{ u.id }}</code> to "{{ u.name }}"
      </div>
    }

    @if (mutation.error(); as err) {
      <div class="status-error"><strong>Error:</strong> {{ err.message }}</div>
    }
  `,
  styles: [`
    h2 { margin-bottom: 0.25rem; }
    .hint { font-size: 0.75rem; color: #9ca3af; margin: 0 0 1.25rem; }
    .form {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.07);
      max-width: 460px;
      margin-bottom: 1rem;
    }
    .field { margin-bottom: 1rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.375rem; }
    input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem; outline: none; }
    input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #bfdbfe; }
    .actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
  `],
})
export class CreateUserComponent {
  readonly name = signal('');
  readonly email = signal('');

  readonly mutation = mutationSignal<CreateUserBody, User>(
    (body) => ({ url: '/users', method: 'POST', body }),
  );

  submit(event: Event): void {
    event.preventDefault();
    this.mutation.mutate({
      name: this.name(),
      email: this.email(),
      username: this.name().toLowerCase().replace(/\s+/g, '.'),
    });
  }
}
