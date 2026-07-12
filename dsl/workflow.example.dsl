workflow 'ejemplo':
  input: chat
  router:
    path: priority
  destinations: [claude, mimo, openclaw]
