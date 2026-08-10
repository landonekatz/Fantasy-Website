# Power Rankings Upload Guide

Hey Mike, here's how to easily upload your weekly Power Rankings so the website automatically updates!

## How It Works
The website has an automated script that runs every week. It looks in the `data/power_rankings/` folder for your text files, reads the rankings you typed out, and automatically updates the website with the new order and trend arrows.

## 1. File Format & Naming
- **Where to save:** Save your files in the `data/power_rankings/` folder.
- **What to name them:** Name your file exactly `week_X.md` (e.g. `week_0.md`, `week_1.md`, `week_14.md`). Make sure it ends in `.md` (Markdown format).

## 2. Writing Your Rankings
You can write your story in Markdown or HTML (Markdown is easier!).
**To ensure the system detects your rankings perfectly**, you MUST start each team's section with `### 1. Name` or `1. Name`. 

**Example of a perfect upload file (e.g. `week_1.md`):**

```markdown
## Week 1 League Updates
It was a crazy week out there...

### 1. Landon
**Positives:** 
He scored a lot of points!

**Negatives:**
His team might regress next week.

### 2. Mike
**Positives:**
My running backs look amazing.

### 3. Ben
(You can use Ben or Benjamin interchangeably, the system knows who you mean!)

...and so on for all 12 teams!
```

## 3. Aliases
The system is smart enough to understand if you write `Ben` or `Benjamin`. You just need to make sure the number matches their rank, and their name is immediately after the number!

## 4. Submitting
Once you've created your `week_X.md` file in `data/power_rankings/`, simply commit and push your changes to the repository! The next time the automated update script runs, it will read your file, automatically re-order the UI, and post your story!
