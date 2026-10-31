# Préparation APK / PWA

## 1) Déploiement web GitHub Pages
Placez à la racine du dépôt :

- index.html
- styles.css
- app.js
- sw.js
- manifest.json
- icon.svg
- capacitor.config.json
- package.json
- APK-README.md

Le site doit être accessible via :
- https://expertkevin06-cell.github.io/my-tech-by-kevin/

## 2) Utilisation PWA
Ouvrir le site sur Android Chrome :
- menu ⋮
- “Ajouter à l’écran d’accueil”

L’application fonctionne alors en mode standalone.

## 3) Fond d’écran pour APK
Dans le mode Admin :
- onglet “APK / Écran”
- téléverser une image ou utiliser le fond par défaut
- cliquer sur “Télécharger wallpaper.png”

Le fichier `wallpaper.png` doit être intégré dans la build Android.

Emplacement conseillé pour Capacitor / Android natif :
- `android/app/src/main/res/drawable/wallpaper.png`

Ou, si vous utilisez un plugin splash screen :
- placer l’image dans `assets/public/` ou `resources/android/` selon le plugin retenu.

## 4) Build APK avec Capacitor

### Prérequis
- Node.js 18+
- Android Studio
- JDK 17 recommandé

### Commandes
Depuis la racine du projet :

```bash
npm install
npm run apk:prepare
npm run cap:open:android
