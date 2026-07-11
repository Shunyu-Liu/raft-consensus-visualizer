# Release Checklist

## Code

- [ ] Node.js matches `.nvmrc`
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run test:coverage`
- [ ] `npm run build`
- [ ] `npm run check`

## Simulator

- [ ] Basic scenario
- [ ] Leader failure scenario
- [ ] Split vote scenario
- [ ] Network partition scenario
- [ ] Conflicting logs scenario
- [ ] Start, Pause, Next Step, Reset, Speed
- [ ] Theme and display mode

## Learn

- [ ] Navigation
- [ ] Concepts
- [ ] Safety properties
- [ ] Glossary search
- [ ] Scenario guide

## Accessibility

- [ ] Keyboard navigation
- [ ] Visible focus
- [ ] Labels
- [ ] Reduced motion
- [ ] Responsive layout

## Documentation

- [ ] README
- [ ] Architecture
- [ ] Raft model
- [ ] Scenarios
- [ ] Roadmap
- [ ] Contributing
- [ ] License
- [ ] Changelog

## Deployment

- [ ] Pages source set to GitHub Actions
- [ ] CI green
- [ ] Deploy green
- [ ] Live URL
- [ ] `/#/simulator`
- [ ] `/#/learn`

## Repository

- [ ] Description
- [ ] Topics
- [ ] Website
- [ ] Social preview
- [ ] Release tag

## Security

- [ ] `npm audit`
- [ ] `npm audit --production`
- [ ] No secrets in tracked files
- [ ] `node_modules`, `dist`, and `coverage` are ignored
