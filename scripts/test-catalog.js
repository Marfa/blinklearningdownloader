/**
 * BLINK_EMAIL / BLINK_PASSWORD
 */
const { app } = require('electron');
const { authenticate } = require('../src/auth');
const { listBooks, listChapters, listExercises, destroyCatalogWindow } = require('../src/blink-catalog');

app.whenReady().then(async () => {
  const auth = await authenticate({
    username: process.env.BLINK_EMAIL,
    password: process.env.BLINK_PASSWORD,
    proxy: { enabled: false },
  });
  if (!auth.success) {
    console.error('auth', auth);
    app.quit();
    return;
  }

  try {
    const books = await listBooks();
    console.log('books', books.length, books.slice(0, 3));
    if (books[0] && !books[0].locked) {
      const chapters = await listChapters(books[0].id);
      console.log('chapters', chapters.length, chapters.slice(0, 3));
      if (chapters[0]) {
        const exercises = await listExercises(books[0].id, chapters[0].id);
        console.log('exercises', exercises.length, exercises.slice(0, 3));
      }
    }
  } catch (e) {
    console.error('ERR', e);
  }

  destroyCatalogWindow();
  app.quit();
});

setTimeout(() => app.quit(), 120000);
