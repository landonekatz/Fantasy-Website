/**
 * The Fantasy Vault, as Manager Display Name & Nickname Formatter
 * 
 * Rules:
 * 1. Nicknames are max 20 characters long.
 * 2. Only displayed if allowNicknames is true (or not explicitly false).
 * 3. Single-word name (e.g. "Landon") -> nickname in quotes following name: Landon "The Commish"
 * 4. Two or more words (e.g. "John Brown" or "John B") -> nickname in quotes in between first and second name: John "Downtown" Brown
 */

export function formatManagerDisplayName(baseName, nickname, allowNicknames = true) {
    if (!baseName) return '';
    const cleanBase = String(baseName).trim();
    if (!cleanBase) return '';
    
    let cleanNick = (nickname || '').trim().slice(0, 20);
    if (!cleanNick || allowNicknames === false) {
        return cleanBase;
    }
    // Strip accidental outer quotes if entered by user
    cleanNick = cleanNick.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    if (!cleanNick) return cleanBase;

    const parts = cleanBase.split(/\s+/);
    if (parts.length === 1) {
        // Single name: Landon -> Landon "The Commish"
        return `${parts[0]} "${cleanNick}"`;
    } else {
        // Two or more words: John Brown -> John "Downtown" Brown
        const firstName = parts[0];
        const rest = parts.slice(1).join(' ');
        return `${firstName} "${cleanNick}" ${rest}`;
    }
}
