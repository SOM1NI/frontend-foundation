# Frontend Foundations

A beginner-friendly front-end practice project for building structured HTML
pages, styling them with CSS, designing responsive layouts, and tracking work
with Git.

## Project Structure

```text
frontend-foundation/
  index.html
  projects.html
  contact.html
  styles.css
  assets/
    workspace.svg
    semantic-page.svg
    responsive-grid.svg
    git-flow.svg
```

## What This Project Practices

- Semantic HTML: header, nav, main, section, article, aside, footer, and forms.
- CSS styling: shared variables, typography, spacing, buttons, cards, and states.
- Responsive layout: CSS Grid, Flexbox, fluid widths, and media queries.
- Git workflow: initialize a repo, check status, stage files, and commit changes.

## Open the Site

Open `index.html` in a browser. The site uses plain HTML and CSS, so no build
step or package install is required.

## Basic Git Commands

Run these from inside the `frontend-foundation` folder:

```bash
git init
git status
git config user.name "Your Name"
git config user.email "you@example.com"
git add index.html projects.html contact.html styles.css assets README.md
git commit -m "Create frontend foundation pages"
```

After future edits:

```bash
git status
git diff
git add .
git commit -m "Describe the change clearly"
```
