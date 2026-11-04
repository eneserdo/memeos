// First-run contents of the file system.
import { join } from "./fs.js";

const H = "/home/pepe";
const text = (s) => s.replace(/^\n/, "").replace(/\n +\|/g, "\n").replace(/^ +\|/, "");

export async function seed(fs) {
  for (const d of ["Desktop", "Documents", "Pictures", "Pictures/Screenshots", "Memes", "Memes/Made with MemeOS", "Downloads", ".secrets"]) await fs.mkdir(join(H, d), { recursive: true });
  await fs.mkdir("/system", { recursive: true });
  await fs.mkdir("/.trash", { recursive: true });

  // app shortcuts on the desktop
  for (const [name, id] of [["Files", "files"], ["Terminal", "terminal"], ["Meme Factory", "factory"], ["Doge Sweeper", "sweeper"], ["Settings", "settings"]])
    await fs.writeFile(join(H, "Desktop", name + ".app"), id);

  await fs.writeFile(join(H, "Desktop", "Read me first.txt"), text(`
    |Welcome to MemeOS.
    |
    |Everything on this screen is real, in the sense that it does what it says:
    |- Files you create are saved in your browser (IndexedDB) and survive a reload.
    |- Deleted files go to the Recycle Bin and can be restored.
    |- The Terminal is a real shell over the same file system (try: ls, cat, tree, neofetch).
    |- The Task Manager shows how much time each window actually spends in its event handlers.
    |- Drag a picture from your computer into Files to import it. Right-click a file to download it.
    |
    |Keyboard: Alt+S start menu, Alt+W switch windows, Alt+T terminal, Alt+E files,
    |Alt+Arrow snap, Alt+N minimize, Alt+Enter maximize, Alt+X close, Alt+D desktop.
    |
    |There are hidden things. The Achievements app keeps score.
  `));

  await fs.writeFile(join(H, "Documents", "welcome.md"), text(`
    |# Hello fren
    |
    |This is a Markdown file sitting in a virtual file system inside a web page.
    |Open it in **Notepad**, change it, press Ctrl+S. Reload the page. Still there.
    |
    |## Things to try
    |
    |1. Open *Meme Factory*, pick a picture from Memes, write something, save it.
    |2. Delete a file, then open the Recycle Bin and restore it.
    |3. In the Terminal type \`tree ~\` and then \`neofetch\`.
    |4. Open Task Manager and drag a window around. Watch the numbers move.
  `));
  await fs.writeFile(join(H, "Documents", "todo.txt"), text(`
    |[x] install MemeOS
    |[x] touch grass
    |[ ] find all the easter eggs
    |[ ] learn what a file system is
    |[ ] buy more RAM (download it)
  `));
  await fs.writeFile(join(H, "Documents", "shopping list.txt"), "bread\nmilk\nbananas\nsmall loan of a million dollars\n");
  await fs.mkdir(join(H, "Documents", "secret plans"));
  await fs.writeFile(join(H, "Documents", "secret plans", "world domination.md"), text(`
    |# Plan
    |
    |1. Collect memes
    |2. ???
    |3. Profit
  `));
  await fs.writeFile(join(H, "Downloads", "totally_legit_installer.txt"), "This is not an installer. This is a text file.\nYou are safe. For now.\n");
  await fs.writeFile(join(H, ".secrets", "do not open.txt"), text(`
    |You opened it.
    |
    |Fine. Here is a secret: the terminal understands the word "hackerman".
    |Type it. Nothing bad will happen. Probably.
  `));
  await fs.writeFile("/system/release-notes.md", text(`
    |# MemeOS 1.0
    |
    |- Window manager with snapping, minimize-to-taskbar, Alt+W switcher
    |- Persistent file system (IndexedDB) with Recycle Bin
    |- Files, Notepad, Photos, Terminal, Task Manager, Meme Factory, Calculator, Doge Sweeper, Surf, Settings, Achievements
    |- Themes, accent colours, wallpapers, acrylic transparency, synthesised UI sounds
    |- Easter eggs: an undisclosed number
  `));
  await fs.writeFile("/system/kernel.log", `[0.000000] MemeOS kernel booting\n[0.000420] much memory: ${navigator.deviceMemory || "?"} GB\n[0.001337] very cores: ${navigator.hardwareConcurrency || "?"}\n[0.004200] wow\n`);

  // meme pictures (referenced, not copied: the browser caches them)
  try {
    const man = await (await fetch("assets/memes/manifest.json")).json();
    for (const [stem, m] of Object.entries(man)) {
      const name = m.name.replace(/[\/\\:*?"<>|]/g, "-") + ".jpg";
      await fs.writeFile(join(H, "Memes", name), null, { ref: `assets/memes/${stem}.jpg`, size: m.bytes, mime: "image/jpeg", meta: { w: m.w, h: m.h, source: m.source } });
    }
  } catch (e) { console.warn("meme seed failed", e); }
}
