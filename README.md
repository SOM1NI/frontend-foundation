# TaskForge Todo List API Site

TaskForge is a complete Todo List API website built for the project brief. It includes
a responsive task dashboard, API documentation, admin panel, signed-token auth, task
CRUD, categories, comments, and JSON-file persistence.

## Run the Site

```bash
npm.cmd start
```

Then open:

```text
http://localhost:3000
```

Demo admin account:

```text
Email: admin@taskforge.dev
Password: admin123
```

The app can also be opened directly through `index.html`. In that mode it uses
browser localStorage and shows `Static demo mode`.

## Project Structure

```text
frontend-foundation/
  index.html        Dashboard and task workspace
  projects.html     API documentation
  contact.html      Admin panel
  styles.css        Shared responsive styling
  app.js            Browser app and API client
  server.js         Local Node.js API and static server
  package.json      npm scripts
  data/db.json      Created automatically on first server run
```

## API Routes

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/categories`
- `POST /api/categories`
- `POST /api/tasks/:id/comments`
- `GET /api/admin/users`

## Notes

This build uses only Node.js built-in modules so it runs immediately in this
workspace. For production, replace JSON-file persistence with MongoDB/Mongoose,
set a strong `JWT_SECRET`, serve behind HTTPS, and add audit logging for role
changes.
