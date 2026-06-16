# יומן מסחר — הוראות לקלוד

## אחרי כל עריכה של קוד

לאחר ביצוע כל שינוי בקוד, הרץ **באופן אוטומטי** את הפקודות הבאות ללא בקשת אישור:

```bash
git add -A
git commit -m "תיאור השינוי"
git push
```

GitHub Actions יבנה את האפליקציה ויפרסם אותה ל-GitHub Pages אוטומטית תוך ~2 דקות לאחר ה-push.

## פרטי פרויקט

- שפה: React + TypeScript + Vite
- עיצוב: Tailwind CSS
- גרפים: Recharts
- בסיס נתונים: Supabase
- GitHub Pages URL: https://netnetyy.github.io/trading-journal/

## נתיב הפרויקט

כל הפקודות יש להריץ מתוך תיקיית `trading-journal/`
