# Webcam Toys Project

This project is a small website that hosts a collection of interactive webcam toys. It's built with plain HTML, CSS, and JavaScript, and is designed to be easily extensible.

## Project Structure

- `index.html`: The main landing page. It contains the navigation menu, the iframe for displaying toys, and the "About" section.
- `style.css`: The main stylesheet for the landing page.
- `script.js`: The main JavaScript file for the landing page. It handles toy selection and fullscreen mode.
- `toys/`: This directory contains all the files related to the individual toys.
  - `toy.html`: A generic HTML file that serves as a host for all the toys. It dynamically loads the selected toy's JavaScript file.
  - `toy-core.js`: A JavaScript file that contains the core `Toy` class. This class handles all the boilerplate for webcam setup, resizing, and the render loop.
  - `[toy-name].js`: Each toy has its own JavaScript file that contains the specific logic for that toy. It defines a class that extends the `Toy` class.

## How to Add a New Toy

1.  **Create a new JavaScript file** in the `toys/` directory (e.g., `toys/new-toy.js`).
2.  **Define a new class** in this file that extends the `Toy` class. This class should implement a `draw()` method that contains the rendering logic for your toy.
3.  **Instantiate your new class** at the end of the file (e.g., `new NewToy();`).
4.  **Add a new link** to the navigation menu in `index.html`. Make sure the `data-toy` attribute matches the name of your new JavaScript file (without the `.js` extension).

For example:

```html
<a href="#" data-toy="new-toy">New Toy</a>
```
