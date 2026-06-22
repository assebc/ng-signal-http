import { Route } from '@angular/router';
import { UsersListComponent } from './users/users-list.component';
import { UserDetailComponent } from './users/user-detail.component';
import { CreateUserComponent } from './users/create-user.component';
import { PostsListComponent } from './posts/posts-list.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  { path: 'users', component: UsersListComponent },
  { path: 'users/detail', component: UserDetailComponent },
  { path: 'users/create', component: CreateUserComponent },
  { path: 'posts', component: PostsListComponent },
];
