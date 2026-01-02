# Changelog

## v1.2.0

[compare changes](https://github.com/JoobyPM/fix-md-tables/compare/v1.1.3...v1.2.0)

### 🚀 Enhancements

- Add --clean flag to remove ideographic spaces before Prettier ([3c79ab8](https://github.com/JoobyPM/fix-md-tables/commit/3c79ab8))

### 🩹 Fixes

- Add defensive null check for code fence regex match ([81cb445](https://github.com/JoobyPM/fix-md-tables/commit/81cb445))
- Warn about unrecognized CLI flags ([b3a1ee8](https://github.com/JoobyPM/fix-md-tables/commit/b3a1ee8))
- Improve emoji compensation formula with base offset ([82aee60](https://github.com/JoobyPM/fix-md-tables/commit/82aee60))
- Apply full compensation when using normalized cell ([32b573c](https://github.com/JoobyPM/fix-md-tables/commit/32b573c))
- Separator rows must remain valid markdown ([5bacf4a](https://github.com/JoobyPM/fix-md-tables/commit/5bacf4a))
- Add missing emoji range Extended-A (U+1FA70-1FAFF) ([5060852](https://github.com/JoobyPM/fix-md-tables/commit/5060852))
- Stricter code fence end detection per CommonMark ([7e20168](https://github.com/JoobyPM/fix-md-tables/commit/7e20168))

### 💅 Refactors

- Extract calculateCompensation helper ([f13c8d1](https://github.com/JoobyPM/fix-md-tables/commit/f13c8d1))

### 📖 Documentation

- Add Cursor workflow rules ([1b42512](https://github.com/JoobyPM/fix-md-tables/commit/1b42512))
- Update README examples and emoji ranges ([ad3040f](https://github.com/JoobyPM/fix-md-tables/commit/ad3040f))

### 🎨 Styles

- Address CodeRabbit nitpicks ([ff60b53](https://github.com/JoobyPM/fix-md-tables/commit/ff60b53))
- Use replaceAll and String.raw per SonarQube ([f32b65c](https://github.com/JoobyPM/fix-md-tables/commit/f32b65c))

### ❤️ Contributors

- Pavel Marakhovskyy ([@JoobyPM](https://github.com/JoobyPM))

## v1.1.3

[compare changes](https://github.com/JoobyPM/fix-md-tables/compare/v1.1.2...v1.1.3)

### 🩹 Fixes

- Normalize existing ideographic spaces to prevent double-compensation ([1c645e4](https://github.com/JoobyPM/fix-md-tables/commit/1c645e4))

### ❤️ Contributors

- Pavel Marakhovskyy ([@JoobyPM](https://github.com/JoobyPM))

## v1.1.2

[compare changes](https://github.com/JoobyPM/fix-md-tables/compare/v1.1.1...v1.1.2)

## v1.1.1

[compare changes](https://github.com/JoobyPM/fix-md-tables/compare/v1.1.0...v1.1.1)

### 🩹 Fixes

- Maintain column width when adding ideographic spaces ([29837ab](https://github.com/JoobyPM/fix-md-tables/commit/29837ab))

### ❤️ Contributors

- Pavel Marakhovskyy

## v1.1.0

[compare changes](https://github.com/joobypm/fix-md-tables/compare/v1.0.0...v1.1.0)

### 🚀 Enhancements

- Add changelog generation and release scripts ([a2aeae7](https://github.com/joobypm/fix-md-tables/commit/a2aeae7))

### 🤖 CI

- Add GitHub Actions CI workflow ([8d92e72](https://github.com/joobypm/fix-md-tables/commit/8d92e72))
- Add GitHub Actions release workflow ([3247577](https://github.com/joobypm/fix-md-tables/commit/3247577))

### ❤️ Contributors

- Pavel Marakhovskyy

## v1.0.0

### 🚀 Enhancements

- Add core library with exportable functions ([52de912](https://github.com/yourname/fix-md-tables/commit/52de912))
- Add CLI entry point ([20b4c13](https://github.com/yourname/fix-md-tables/commit/20b4c13))
- Add package.json for npm publishing ([ce7b7b4](https://github.com/yourname/fix-md-tables/commit/ce7b7b4))

### 🩹 Fixes

- Address SonarQube warnings ([a8ad49f](https://github.com/yourname/fix-md-tables/commit/a8ad49f))
- Skip tables inside fenced code blocks ([3395852](https://github.com/yourname/fix-md-tables/commit/3395852))

### 🏡 Chore

- Add prettier configuration ([9dda7f3](https://github.com/yourname/fix-md-tables/commit/9dda7f3))
- Add ESLint 9 with flat config ([f92ea65](https://github.com/yourname/fix-md-tables/commit/f92ea65))

### ✅ Tests

- Add comprehensive test suite with vitest ([7ecc7fc](https://github.com/yourname/fix-md-tables/commit/7ecc7fc))
