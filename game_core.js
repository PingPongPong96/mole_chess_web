(function (global) {
    'use strict';

    const ROW_LETTERS = 'abcdefghijkl';

    const CoordinateConverter = {
        ROW_LETTERS,
        algebraicToNumeric(algebraic) {
            if (!algebraic || algebraic.length < 2) {
                throw new Error(`Invalid algebraic: ${algebraic}`);
            }
            const firstChar = algebraic[0];
            const isUpper = firstChar === firstChar.toUpperCase();
            const colLetter = firstChar.toLowerCase();
            const rowStr = algebraic.slice(1);
            if (!ROW_LETTERS.includes(colLetter)) {
                throw new Error(`Invalid column letter: ${colLetter}`);
            }
            const rowNum = parseInt(rowStr, 10);
            if (Number.isNaN(rowNum)) {
                throw new Error(`Invalid row number: ${rowStr}`);
            }
            const col = ROW_LETTERS.indexOf(colLetter);
            // Backward compatibility:
            // uppercase => A1-L12, lowercase => a0-l11.
            let row;
            if (isUpper || rowNum === 12) {
                if (rowNum < 1 || rowNum > 12) {
                    throw new Error(`Invalid row number: ${rowStr}`);
                }
                row = rowNum - 1;
            } else {
                if (rowNum < 0 || rowNum > 11) {
                    throw new Error(`Invalid row number: ${rowStr}`);
                }
                row = rowNum;
            }
            return [row, col];
        },
        numericToAlgebraic(row, col) {
            if (row < 0 || row > 11) {
                throw new Error(`Row out of range: ${row}`);
            }
            if (col < 0 || col > 11) {
                throw new Error(`Col out of range: ${col}`);
            }
            const colLetter = ROW_LETTERS[col].toUpperCase();
            const rowNumber = row + 1;
            return `${colLetter}${rowNumber}`;
        },
        isValidAlgebraic(algebraic) {
            try {
                CoordinateConverter.algebraicToNumeric(algebraic);
                return true;
            } catch (e) {
                return false;
            }
        },
        isValidNumeric(row, col) {
            return row >= 0 && row <= 11 && col >= 0 && col <= 11;
        }
    };

    function a2n(algebraic) {
        return CoordinateConverter.algebraicToNumeric(algebraic);
    }

    function n2a(row, col) {
        return CoordinateConverter.numericToAlgebraic(row, col);
    }

    function fmtPos(row, col) {
        return n2a(row, col);
    }

    class DiceEngine {
        static roll_single() {
            if (Array.isArray(DiceEngine._forcedRolls) && DiceEngine._forcedRolls.length > 0) {
                return DiceEngine._forcedRolls.shift();
            }
            return Math.floor(Math.random() * 10);
        }
        static roll_double() {
            const d1 = DiceEngine.roll_single();
            const d2 = DiceEngine.roll_single();
            return d1 * 10 + d2;
        }
        static roll_double_with_retry() {
            const rolls = [];
            while (true) {
                const d1 = DiceEngine.roll_single();
                const d2 = DiceEngine.roll_single();
                const result = d1 * 10 + d2;
                rolls.push(result);
                if (d1 === d2) {
                    continue;
                }
                return [result, rolls.length > 1, rolls];
            }
        }
        static judge_skill(skill_name, modifier = 0) {
            const result = DiceEngine.roll_double();
            if (result === 0) {
                return ['critical', result];
            }
            const threshold = 50 - modifier;
            if (result >= threshold) {
                return ['success', result];
            }
            return ['fail', result];
        }
        static judge_with_table(result, thresholds) {
            for (const key of Object.keys(thresholds)) {
                const value = thresholds[key];
                if (Array.isArray(value)) {
                    if (result >= value[0] && result <= value[1]) {
                        return key;
                    }
                } else if (result === value) {
                    return key;
                }
            }
            return 'unknown';
        }
        static withForcedRolls(rolls, fn) {
            const prev = DiceEngine._forcedRolls;
            DiceEngine._forcedRolls = Array.isArray(rolls) ? rolls.slice() : null;
            try {
                return fn();
            } finally {
                DiceEngine._forcedRolls = prev;
            }
        }
    }
    DiceEngine._forcedRolls = null;

    function roll_for_night_day() {
        const result = DiceEngine.roll_double();
        if (result === 0) {
            return ['permanent_night', result, Infinity];
        }
        if (result >= 50 && result <= 99) {
            return ['night', result, 3];
        }
        return ['day', result, 1];
    }

    function roll_for_possession() {
        const result = DiceEngine.roll_double();
        if (result === 0) {
            return ['permanent', result];
        }
        if (result >= 50 && result <= 99) {
            return ['success', result];
        }
        return ['fail', result];
    }

    function roll_for_red_song(official_alive = true, success_bonus = 0) {
        const result = DiceEngine.roll_double();
        if (result === 0) {
            return ['permanent', result];
        }
        const baseRate = official_alive ? 50 : 25;
        const finalRate = Math.max(0, Math.min(100, baseRate + Math.max(0, success_bonus)));
        const threshold = Math.max(0, 100 - finalRate);
        if (result >= threshold) {
            return ['success', result];
        }
        return ['fail', result];
    }

    function roll_for_arrest() {
        const result = DiceEngine.roll_double();
        if (result === 0) {
            return ['execute', result];
        }
        if (result >= 50 && result <= 99) {
            return ['arrest', result];
        }
        return ['fail', result];
    }

    function isNightmarePiece(piece) {
        if (!piece) return false;
        return piece.name === '夜魔' || piece.is_nightmare === true;
    }

    function isPublicPiece(piece) {
        if (!piece) return false;
        return ['鼹鼠', '僧侣', '魔笛手', '广场舞大妈', '死神'].includes(piece.name);
    }

    function canCaptureTargetPiece(attacker, target_piece) {
        if (!attacker || !target_piece) return false;
        if (target_piece.state !== 'alive') return false;
        if (attacker.name !== '死神' && isPublicPiece(attacker)) return false;
        if (attacker.name !== '死神' && isPublicPiece(target_piece)) return false;
        const monkProtected = target_piece.state === 'monk_forever' || !!target_piece.is_saved;
        if (monkProtected && attacker.name !== '死神') return false;
        if (attacker.name !== '死神' && isNightmarePiece(target_piece)) return false;
        if (typeof attacker.can_capture === 'function' && !attacker.can_capture(target_piece)) return false;
        return true;
    }

    function resolveCaptureTargetFromCell(attacker, cell) {
        if (!attacker || !Array.isArray(cell) || cell.length === 0) return null;
        const top = cell[cell.length - 1];
        if (canCaptureTargetPiece(attacker, top)) {
            return top;
        }
        // 叠层规则：若顶层是广场舞大妈，可尝试吃下层可吃目标。
        if (attacker.name !== '死神' && top && top.name === '广场舞大妈') {
            for (let i = cell.length - 2; i >= 0; i -= 1) {
                const candidate = cell[i];
                if (canCaptureTargetPiece(attacker, candidate)) {
                    return candidate;
                }
            }
        }
        return null;
    }

    function canCaptureCell(board, attacker, x, y) {
        const cell = board.get_cell(x, y);
        if (!cell || cell.length === 0) return false;
        return !!resolveCaptureTargetFromCell(attacker, cell);
    }

    class Board {
        constructor() {
            this.grid = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => []));
            this.ghost_pool = [];
            this.size = 12;
        }
        is_valid_position(x, y) {
            return x >= 0 && x < this.size && y >= 0 && y < this.size;
        }
        get_cell(x, y) {
            if (!this.is_valid_position(x, y)) return null;
            return this.grid[x][y];
        }
        get_top_piece(x, y) {
            const cell = this.get_cell(x, y);
            if (cell && cell.length > 0) {
                return cell[cell.length - 1];
            }
            return null;
        }
        add_piece(piece, x, y) {
            if (!this.is_valid_position(x, y)) return false;
            this.grid[x][y].push(piece);
            piece.position = [x, y];
            return true;
        }
        remove_top_piece(x, y) {
            const cell = this.get_cell(x, y);
            if (cell && cell.length > 0) {
                return cell.pop();
            }
            return null;
        }
        remove_piece(piece, x, y) {
            const cell = this.get_cell(x, y);
            if (cell) {
                const idx = cell.indexOf(piece);
                if (idx !== -1) {
                    cell.splice(idx, 1);
                    return true;
                }
            }
            return false;
        }
        remove_specific_piece(piece) {
            if (!piece || !Array.isArray(piece.position)) return false;
            const [x, y] = piece.position;
            return this.remove_piece(piece, x, y);
        }
        move_specific_piece(piece, to_x, to_y) {
            if (!piece || !Array.isArray(piece.position)) return false;
            if (!this.is_valid_position(to_x, to_y)) return false;
            const [from_x, from_y] = piece.position;
            const removed = this.remove_piece(piece, from_x, from_y);
            if (!removed) return false;
            return this.add_piece(piece, to_x, to_y);
        }
        move_piece(from_x, from_y, to_x, to_y) {
            if (!this.is_valid_position(from_x, from_y) || !this.is_valid_position(to_x, to_y)) {
                return false;
            }
            const piece = this.remove_top_piece(from_x, from_y);
            if (!piece) return false;
            this.add_piece(piece, to_x, to_y);
            if (Object.prototype.hasOwnProperty.call(piece, 'has_moved')) {
                piece.has_moved = true;
            }
            return true;
        }
        add_to_ghost_pool(piece) {
            piece.state = 'ghost';
            this.ghost_pool.push(piece);
        }
        clear_cell(x, y) {
            if (this.is_valid_position(x, y)) {
                this.grid[x][y] = [];
            }
        }
        setup_initial_position(black_first = true) {
            const neutral_row_idx = black_first ? 6 : 5;
            const black_back_pieces = ['police', 'officer', 'teacher', 'child', 'ye', 'wife', 'doctor', 'lawyer'];
            const black_cols = Array.from({ length: 8 }, (_, i) => i + 2);
            black_cols.forEach((col_idx, i) => {
                const piece = create_piece(black_back_pieces[i], 'black', [0, col_idx]);
                this.add_piece(piece, 0, col_idx);
            });
            black_cols.forEach((col_idx) => {
                const piece = create_piece('citizen', 'black', [1, col_idx]);
                this.add_piece(piece, 1, col_idx);
            });
            const white_back_pieces = ['police', 'officer', 'teacher', 'child', 'ye', 'wife', 'doctor', 'lawyer'];
            black_cols.forEach((col_idx, i) => {
                const piece = create_piece(white_back_pieces[i], 'white', [11, col_idx]);
                this.add_piece(piece, 11, col_idx);
            });
            black_cols.forEach((col_idx) => {
                const piece = create_piece('citizen', 'white', [10, col_idx]);
                this.add_piece(piece, 10, col_idx);
            });
            const neutral_configs = [
                [0, 'monk'],
                [1, 'piper'],
                [5, 'deathgod'],
                [10, 'squaredancer'],
                [11, 'mole']
            ];
            neutral_configs.forEach(([col_idx, piece_type]) => {
                const piece = create_piece(piece_type, 'neutral', [neutral_row_idx, col_idx]);
                this.add_piece(piece, neutral_row_idx, col_idx);
            });
            return true;
        }
        toString() {
            const result = [];
            for (let i = 0; i < this.grid.length; i++) {
                let rowStr = `${i.toString().padStart(2, ' ')} |`;
                for (const cell of this.grid[i]) {
                    if (cell.length === 0) {
                        rowStr += ' . ';
                    } else {
                        const top = cell[cell.length - 1];
                        rowStr += ` ${top.symbol} `;
                    }
                }
                result.push(rowStr);
            }
            return result.join('\n');
        }
    }

    class Piece {
        constructor(name, symbol, team, position = [0, 0]) {
            this.name = name;
            this.symbol = symbol;
            this.team = team;
            this.position = position;
            this.initial_position = position;
            this.state = 'alive';
            this.is_saved = false;
            this.save_duration = 0;
            this.just_saved = false;
            this.just_saved_turns = 0;
            this.is_arrested = false;
            this.arrest_duration = 0;
        }
        get_valid_moves(board) {
            throw new Error('Subclass must implement get_valid_moves');
        }
        can_capture(target_piece) {
            if (isNightmarePiece(target_piece)) return false;
            if (target_piece.team === this.team) return false;
            return true;
        }
        toString() {
            return `${this.name}(${this.symbol})`;
        }
    }

    Piece._next_uid = 1;

    function ensureUid(piece) {
        if (!piece) return null;
        if (!Object.prototype.hasOwnProperty.call(piece, 'uid') || piece.uid === null || piece.uid === undefined) {
            piece.uid = Piece._next_uid;
            Piece._next_uid += 1;
        }
        return piece.uid;
    }

    function isCitizenHostedByGreenWife(board, citizen) {
        if (!board || !citizen || citizen.name !== '市民' || !Array.isArray(citizen.position)) return false;
        const [x, y] = citizen.position;
        if (!board.is_valid_position(x, y)) return false;
        const cell = board.get_cell(x, y);
        if (!cell || !cell.length) return false;
        return cell.some(piece => piece && piece.is_green_wife && piece.host_citizen === citizen);
    }

    function refreshCitizenUpgradeFlags(board) {
        for (let r = 0; r < board.size; r += 1) {
            for (let c = 0; c < board.size; c += 1) {
                const cell = board.get_cell(r, c);
                for (const piece of cell) {
                    if (piece && piece.name === '市民' && piece.state === 'alive') {
                        piece.check_upgrade_condition(board);
                    }
                }
            }
        }
    }

    class Citizen extends Piece {
        constructor(team, position = [0, 0]) {
            super('市民', '人', team, position);
            this.is_infected = false;
            this.kill_count = 0;
            this.can_upgrade = false;
            this.has_moved = false;
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const forward = this.team === 'black' ? 1 : -1;
            const new_x = x + forward;
            if (board.is_valid_position(new_x, y)) {
                if (board.get_cell(new_x, y).length === 0) {
                    moves.push([new_x, y]);
                    if (!this.has_moved) {
                        const new_x2 = x + forward * 2;
                        if (board.is_valid_position(new_x2, y)) {
                            if (board.get_cell(new_x2, y).length === 0) {
                                moves.push([new_x2, y]);
                            }
                        }
                    }
                }
            }
            // Bug 7 fix: Citizens can capture diagonally backward
            const capture_moves = this.get_capture_moves(board);
            for (const cm of capture_moves) {
                moves.push(cm);
            }
            return moves;
        }
        get_capture_moves(board) {
            const [x, y] = this.position;
            const captures = [];
            const backward = this.team === 'black' ? -1 : 1;
            const capture_dirs = [[backward, -1], [backward, 1]];
            for (const [dx, dy] of capture_dirs) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0 && resolveCaptureTargetFromCell(this, cell)) {
                        captures.push([new_x, new_y]);
                    }
                }
            }
            return captures;
        }
        check_upgrade_condition(board) {
            if (isCitizenHostedByGreenWife(board, this)) {
                this.can_upgrade = false;
                return false;
            }
            const [x] = this.position;
            if (this.team === 'black') {
                if (x >= 11) {
                    this.can_upgrade = true;
                    return true;
                }
            } else {
                if (x <= 0) {
                    this.can_upgrade = true;
                    return true;
                }
            }
            this.can_upgrade = false;
            return false;
        }
        get_upgrade_options() {
            if (!this.can_upgrade) return [];
            return ['officer', 'police', 'lawyer', 'teacher', 'doctor'];
        }
        can_capture(target_piece) {
            return !!(target_piece
                && !isNightmarePiece(target_piece)
                && target_piece.team !== this.team
                && target_piece.state === 'alive');
        }
    }

    class Lawyer extends Piece {
        constructor(team, position = [0, 0]) {
            super('律师', '律', team, position);
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dx, dy] of directions) {
                let step = 1;
                while (true) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (!board.is_valid_position(new_x, new_y)) break;
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) {
                        if (canCaptureCell(board, this, new_x, new_y)) {
                            moves.push([new_x, new_y]);
                        }
                        break;
                    } else {
                        moves.push([new_x, new_y]);
                    }
                    step += 1;
                }
            }
            return moves;
        }
    }

    class Doctor extends Piece {
        constructor(team, position = [0, 0]) {
            super('医生', '医', team, position);
        }
        get_valid_moves(board) {
            if (this.is_frozen) return [];
            const [x, y] = this.position;
            const moves = [];
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dx, dy] of directions) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
        can_capture() {
            return false;
        }
    }

    class Ye extends Piece {
        constructor(team, position = [0, 0]) {
            super('叶某', '叶', team, position);
            this.is_nightmare = false;
            this.nightmare_duration = 0;
            this.is_night = false;
        }
        check_transformation_conditions(board) {
            const [x] = this.position;
            const in_enemy_zone = this.team === 'black' ? x >= 10 : x <= 1;
            if (!in_enemy_zone) return false;
            let wife_possessed = false;
            let child_learned = false;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.team === this.team) {
                            if ((piece.name === '妻子' || piece.name === '绿叶妻') && piece.is_green_wife) {
                                wife_possessed = true;
                            } else if ((piece.name === '孩子' || piece.name === '红叶儿') && (piece.learned_red_song || piece.is_red_child)) {
                                child_learned = true;
                            }
                        }
                    }
                }
            }
            return wife_possessed && child_learned;
        }
        transform_to_nightmare() {
            this.is_nightmare = true;
            this.symbol = '夜';
            this.name = '夜魔';
            this.is_night = true;
            // 按规则：变身当回合进入黑夜，并持续到下一回合。
            this.nightmare_duration = 2;
            return [true, 0, 2, '变身为夜魔！初始自动判定为黑夜（持续2回合）'];
        }
        // Bug 18 fix: Add can_move_now to Ye when in nightmare mode
        can_move_now() {
            if (this.is_nightmare) {
                return this.is_night || this.permanent_night;
            }
            return true;
        }
        can_capture(target_piece) {
            if (this.is_nightmare) {
                return target_piece.name === '市民' && target_piece.team !== this.team;
            }
            return super.can_capture(target_piece);
        }
        get_valid_moves(board) {
            if (this.is_nightmare) {
                if (!this.is_night) return [];
                const [x, y] = this.position;
                const moves = [];
                const directions = [
                    [-1, -1], [-1, 0], [-1, 1],
                    [0, -1], [0, 1],
                    [1, -1], [1, 0], [1, 1]
                ];
                for (const [dx, dy] of directions) {
                    let step = 1;
                    while (true) {
                        const new_x = x + dx * step;
                        const new_y = y + dy * step;
                        if (!board.is_valid_position(new_x, new_y)) break;
                        const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) {
                        const target_piece = resolveCaptureTargetFromCell(this, cell);
                        if (target_piece && target_piece.name === '市民' && target_piece.team !== this.team) {
                            moves.push([new_x, new_y]);
                            step += 1;
                            continue;
                        } else if (target_piece) {
                            moves.push([new_x, new_y]);
                        }
                        break;
                    } else {
                        moves.push([new_x, new_y]);
                        }
                        step += 1;
                    }
                }
                return moves;
            }
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    } else if (canCaptureCell(board, this, new_x, new_y)) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
    }

    class Nightmare extends Piece {
        constructor(team, position = [0, 0], original_ye = null) {
            super('夜魔', '夜', team, position);
            this.original_ye = original_ye;
            this.is_nightmare = true;
            this.is_night = true;
            this.night_duration = 0;
            this.nightmare_duration = 0;
            this.permanent_night = false;
            this.skill_used_this_turn = false;
            this.night_roll_skip_round_tick = false;
        }
        roll_day_night(options = {}) {
            const skipRoundTick = !!(options && options.skipRoundTick);
            if (this.permanent_night) {
                return [true, -1, null, '永久黑夜状态，无需判定'];
            }
            const dice = DiceEngine.roll_double();
            if (dice === 0) {
                this.permanent_night = true;
                this.is_night = true;
                this.night_duration = -1;
                this.nightmare_duration = -1;
                this.night_roll_skip_round_tick = skipRoundTick;
                return [true, -1, dice, '骰子00！永久黑夜降临！夜魔可永久移动'];
            }
            if (dice >= 50) {
                this.is_night = true;
                this.night_duration = 3;
                this.nightmare_duration = 3;
                this.night_roll_skip_round_tick = skipRoundTick;
                return [true, 3, dice, `骰子${dice.toString().padStart(2, '0')}≥50，黑夜降临！可移动3回合`];
            }
            this.is_night = false;
            this.night_duration = 1;
            this.nightmare_duration = 1;
            this.night_roll_skip_round_tick = skipRoundTick;
            return [false, 1, dice, `骰子${dice.toString().padStart(2, '0')}<50，白昼来临（持续1回合），夜魔无法移动`];
        }
        decrement_night_duration() {
            if (this.permanent_night) return false;
            if (this.night_duration > 0) {
                this.night_duration -= 1;
                if (this.night_duration === 0) {
                    this.is_night = false;
                    return true;
                }
            }
            return false;
        }
        can_move_now() {
            return this.is_night || this.permanent_night;
        }
        can_capture(target_piece) {
            if (!target_piece) return false;
            return target_piece.name === '市民' && target_piece.team !== this.team;
        }
        can_be_captured_by(attacker_piece) {
            return attacker_piece.name === '警察';
        }
        get_crush_targets(board, target_x, target_y) {
            const [x, y] = this.position;
            const dx = target_x === x ? 0 : (target_x > x ? 1 : -1);
            const dy = target_y === y ? 0 : (target_y > y ? 1 : -1);
            if (dx !== 0 && dy !== 0) {
                if (Math.abs(target_x - x) !== Math.abs(target_y - y)) {
                    return [];
                }
            }
            const citizens_to_crush = [];
            let step = 1;
            while (true) {
                const check_x = x + dx * step;
                const check_y = y + dy * step;
                if ((dx >= 0 && check_x > target_x) || (dx <= 0 && check_x < target_x)) break;
                if ((dy >= 0 && check_y > target_y) || (dy <= 0 && check_y < target_y)) break;
                if (!board.is_valid_position(check_x, check_y)) break;
                const cell = board.get_cell(check_x, check_y);
                for (const piece of cell) {
                    if (piece.name === '市民' && piece.team !== this.team) {
                        citizens_to_crush.push([piece, [check_x, check_y]]);
                    }
                }
                if (check_x === target_x && check_y === target_y) break;
                step += 1;
            }
            return citizens_to_crush;
        }
        get_valid_moves(board) {
            if (!this.can_move_now()) return [];
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                let step = 1;
                while (true) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (!board.is_valid_position(new_x, new_y)) break;
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) {
                        const target_piece = resolveCaptureTargetFromCell(this, cell);
                        if (target_piece && target_piece.name === '市民' && target_piece.team !== this.team) {
                            moves.push([new_x, new_y]);
                            step += 1;
                            continue;
                        }
                        break;
                    } else {
                        moves.push([new_x, new_y]);
                    }
                    step += 1;
                }
            }
            return moves;
        }
        get_night_duration_display() {
            if (this.permanent_night) return '∞';
            if (this.is_night && this.night_duration > 0) return String(this.night_duration);
            return '';
        }
    }

    class Wife extends Piece {
        constructor(team, position = [0, 0]) {
            super('妻子', '妻', team, position);
            this.is_possessed = false;
            this.host_citizen = null;
            this.is_green_wife = false;
        }
        can_capture(target_piece) {
            if (this.is_green_wife) return false;
            return super.can_capture(target_piece);
        }
        possess_citizen(board, target_x, target_y) {
            const [success, dice, msg] = SkillManager.wife_possess(board, this, target_x, target_y);
            if (success) {
                this.is_green_wife = true;
                this.is_possessed = true;
                this.was_green_wife = true;
                this.name = '绿叶妻';
                this.symbol = '绿';
            }
            return [success, dice, msg];
        }
        release_possession(board) {
            board.remove_piece(this, this.position[0], this.position[1]);
            this.is_possessed = false;
            this.is_green_wife = false;
            this.name = '妻子';
            this.symbol = '妻';
            this.host_citizen = null;
            board.add_piece(this, this.initial_position[0], this.initial_position[1]);
            return [true, '解除附身，妻子回到了家'];
        }
        roll_for_green_wife_move() {
            const dice = DiceEngine.roll_double();
            const tens = Math.floor(dice / 10);
            const ones = dice % 10;
            if (tens === 0) {
                return [0, 0, dice, `骰子${dice.toString().padStart(2, '0')}，点数0：解除附身，回到原位`];
            }
            if (tens === 9) {
                return [9, 0, dice, `骰子${dice.toString().padStart(2, '0')}，点数9：再摇一次`];
            }
            const direction_names = ['', '↖', '↑', '↗', '←', '→', '↙', '↓', '↘'];
            return [tens, ones, dice, `骰子${dice.toString().padStart(2, '0')}，方向${direction_names[tens]}，格数${ones}`];
        }
        get_green_wife_move(board, direction_idx, steps) {
            const directions_map = {
                1: [-1, -1], 2: [-1, 0], 3: [-1, 1],
                4: [0, -1], 5: [0, 1],
                6: [1, -1], 7: [1, 0], 8: [1, 1]
            };
            if (!directions_map[direction_idx]) return null;
            const [dx, dy] = directions_map[direction_idx];
            const [x, y] = this.position;
            let final_pos = this.position;
            for (let step = 1; step <= steps; step += 1) {
                const new_x = x + dx * step;
                const new_y = y + dy * step;
                if (!board.is_valid_position(new_x, new_y)) break;
                // 绿叶妻移动无视路径与落点障碍，仅受棋盘边界限制。
                final_pos = [new_x, new_y];
            }
            return (final_pos[0] !== this.position[0] || final_pos[1] !== this.position[1]) ? final_pos : null;
        }
        get_valid_moves(board) {
            if (this.is_green_wife) {
                // 绿叶妻移动由双骰随机决定，前端无需选择目标格。
                return [this.position.slice()];
            }
            const [x, y] = this.position;
            const moves = [];
            const forward_dirs = this.team === 'black'
                ? [[1, -1], [1, 0], [1, 1], [0, -1], [0, 1]]
                : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1]];
            for (const [dx, dy] of forward_dirs) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    } else if (canCaptureCell(board, this, new_x, new_y)) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
        _get_all_possible_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, 0], [-1, 1], [0, 1], [1, 1],
                [1, 0], [1, -1], [0, -1], [-1, -1]
            ];
            for (const [dx, dy] of directions) {
                for (let step = 1; step < 10; step += 1) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (!board.is_valid_position(new_x, new_y)) break;
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) {
                        if (canCaptureCell(board, this, new_x, new_y)) {
                            moves.push([new_x, new_y]);
                        }
                        break;
                    }
                    moves.push([new_x, new_y]);
                }
            }
            return moves;
        }
    }

    class Child extends Piece {
        constructor(team, position = [0, 0]) {
            super('孩子', '子', team, position);
            this.learned_red_song = false;
            this.can_jump_grave = true;
            this.is_red_child = false;
            this.red_song_bonus = 0;
            this.red_song_success_count = 0;
        }
        learn_red_song(board) {
            const [success, dice, msg] = SkillManager.child_learn_red_song(board, this);
            if (success) {
                this.is_red_child = true;
                this.was_red_child = true;
                this.name = '红叶儿';
                this.symbol = '红';
                this.can_jump_grave = false;
            }
            return [success, dice, msg];
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            let forbidden_dirs = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            if (!this.is_red_child) {
                forbidden_dirs = this.team === 'black' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
            }
            const allowed_dirs = directions.filter(d => !forbidden_dirs.some(f => f[0] === d[0] && f[1] === d[1]));
            for (const [dx, dy] of allowed_dirs) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    const has_grave = cell.some(p => p instanceof Grave);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    } else if (has_grave && this.can_jump_grave && !this.is_red_child) {
                        const jump_x = new_x + dx;
                        const jump_y = new_y + dy;
                        if (board.is_valid_position(jump_x, jump_y)) {
                            moves.push([jump_x, jump_y]);
                        }
                    } else if (canCaptureCell(board, this, new_x, new_y)) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
    }

    class Police extends Piece {
        constructor(team, position = [0, 0]) {
            super('警察', '警', team, position);
            this.can_move = true;
            this.arrested_piece = null;
        }
        has_alive_officer(board) {
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    for (const p of board.get_cell(i, j)) {
                        if (p.name === '官员' && p.team === this.team && p.state === 'alive') {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        can_capture(target_piece) {
            if (!target_piece) return false;
            // Bug 9 fix: Police cannot capture nightmare or piper normally, only via arrest skill
            if (target_piece.name === '夜魔' || target_piece.name === '魔笛手') {
                return false;
            }
            return target_piece.team !== this.team && target_piece.state === 'alive';
        }
        get_arrest_targets(board) {
            if (!this.can_move) return [];
            if (!this.has_alive_officer(board)) return [];
            const [x, y] = this.position;
            const targets = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                let step = 1;
                while (true) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (!board.is_valid_position(new_x, new_y)) break;
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) {
                        const top_piece = cell[cell.length - 1];
                        if (
                            top_piece.state === 'alive'
                            && top_piece.team !== this.team
                            && (top_piece.name === '夜魔' || top_piece.name === '魔笛手')
                        ) {
                            targets.push([new_x, new_y]);
                        }
                        break;
                    }
                    step += 1;
                }
            }
            return targets;
        }
        get_valid_moves(board) {
            if (!this.can_move) return [];
            // Bug 10 fix: Police cannot move when all same-team officers are dead
            if (!this.has_alive_officer(board)) return [];
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                let step = 1;
                while (true) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (!board.is_valid_position(new_x, new_y)) break;
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) {
                        if (canCaptureCell(board, this, new_x, new_y)) {
                            moves.push([new_x, new_y]);
                        }
                        break;
                    } else {
                        moves.push([new_x, new_y]);
                    }
                    step += 1;
                }
            }
            return moves;
        }
    }

    class Teacher extends Piece {
        constructor(team, position = [0, 0]) {
            super('老师', '师', team, position);
            this.teach_bonus = 10;
        }
        can_capture(target_piece) {
            return !!(target_piece
                && !isNightmarePiece(target_piece)
                && target_piece.team !== this.team
                && target_piece.state === 'alive');
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            for (const [dx, dy] of directions) {
                let step = 1;
                while (true) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (!board.is_valid_position(new_x, new_y)) break;
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) {
                        if (canCaptureCell(board, this, new_x, new_y)) {
                            moves.push([new_x, new_y]);
                        }
                        break;
                    } else {
                        moves.push([new_x, new_y]);
                    }
                    step += 1;
                }
            }
            return moves;
        }
    }

    class Officer extends Piece {
        constructor(team, position = [0, 0]) {
            super('官员', '官', team, position);
        }
        can_capture(target_piece) {
            return !!(target_piece
                && !isNightmarePiece(target_piece)
                && target_piece.team !== this.team
                && target_piece.state === 'alive');
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const knight_moves = [
                [-2, -1], [-2, 1],
                [-1, -2], [-1, 2],
                [1, -2], [1, 2],
                [2, -1], [2, 1]
            ];
            for (const [dx, dy] of knight_moves) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    } else if (canCaptureCell(board, this, new_x, new_y)) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
    }

    class Mole extends Piece {
        constructor(position = [0, 0]) {
            super('鼹鼠', '鼠', 'neutral', position);
            this.can_dig = true;
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
        can_capture() {
            return false;
        }
    }

    class DeathGod extends Piece {
        constructor(position = [0, 0]) {
            super('死神', '死', 'neutral', position);
            this.can_clear = true;
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                for (let step = 1; step < 3; step += 1) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (board.is_valid_position(new_x, new_y)) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
        can_capture() {
            return true;
        }
    }

    class Monk extends Piece {
        constructor(position = [0, 0]) {
            super('僧侣', '僧', 'neutral', position);
            this.saved_positions = [];
            this.active_saved_uid = null;
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
        can_capture() {
            return false;
        }
    }

    class Piper extends Piece {
        constructor(position = [0, 0]) {
            super('魔笛手', '笛', 'neutral', position);
            this.infected_citizens = [];
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                let step = 1;
                while (true) {
                    const new_x = x + dx * step;
                    const new_y = y + dy * step;
                    if (!board.is_valid_position(new_x, new_y)) break;
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length > 0) break;
                    moves.push([new_x, new_y]);
                    step += 1;
                }
            }
            return moves;
        }
        can_capture() {
            return false;
        }
    }

    class SquareDancer extends Piece {
        constructor(position = [0, 0]) {
            super('广场舞大妈', '舞', 'neutral', position);
            this.dance_partner = null;
        }
        get_valid_moves(board) {
            const [x, y] = this.position;
            const moves = [];
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    if (cell.length === 0) {
                        moves.push([new_x, new_y]);
                    }
                }
            }
            return moves;
        }
        can_capture() {
            return false;
        }
    }

    function create_piece(piece_type, team, position = [0, 0]) {
        const piece_map = {
            ye: Ye,
            nightmare: Nightmare,
            wife: Wife,
            child: Child,
            citizen: Citizen,
            lawyer: Lawyer,
            doctor: Doctor,
            police: Police,
            teacher: Teacher,
            officer: Officer,
            mole: Mole,
            deathgod: DeathGod,
            monk: Monk,
            piper: Piper,
            squaredancer: SquareDancer
        };
        const cls = piece_map[piece_type.toLowerCase()];
        if (!cls) {
            throw new Error(`Unknown piece type: ${piece_type}`);
        }
        if (['mole', 'deathgod', 'monk', 'piper', 'squaredancer'].includes(piece_type.toLowerCase())) {
            return new cls(position);
        }
        return new cls(team, position);
    }

    class Grave {
        constructor(original_piece) {
            this.name = '墓';
            this.symbol = '墓';
            this.team = 'neutral';
            this.position = original_piece.position;
            this.state = 'grave';
            this.original_piece = original_piece;
            this.original_name = original_piece.name;
            this.original_team = original_piece.team;
        }
        toString() {
            return `墓(${this.original_name})`;
        }
    }

    class LifeCycleManager {
        static kill(board, piece) {
            const [x, y] = piece.position;
            piece.state = 'dead';
            const grave = new Grave(piece);
            grave.position = [x, y];
            board.remove_piece(piece, x, y);
            board.add_piece(grave, x, y);
            return grave;
        }
        static banish(board, piece) {
            const [x, y] = piece.position;
            piece.state = 'ghost';
            board.remove_piece(piece, x, y);
            board.add_to_ghost_pool(piece);
        }
        static kill_piece(board, piece, x, y) {
            piece.state = 'dead';  // Mark the piece as dead
            const grave = new Grave(piece);
            grave.position = [x, y];
            return grave;
        }
        static banish_to_ghost_pool(board, piece) {
            board.add_to_ghost_pool(piece);
        }
        static resurrect_from_grave(board, grave, x, y) {
            const cell = board.get_cell(x, y);
            if (cell && cell.includes(grave)) {
                const piece = grave.original_piece;
                piece.state = 'alive';
                cell.splice(cell.indexOf(grave), 1);
                board.add_piece(piece, x, y);
                return true;
            }
            return false;
        }
    }

    class SkillManager {
        static doctor_resurrect(board, doctor, target_x, target_y) {
            if (!Number.isInteger(target_x) || !Number.isInteger(target_y)) {
                return [false, null, '请选择一个墓碑进行复活'];
            }
            if (!board.is_valid_position(target_x, target_y)) {
                return [false, null, '目标位置无效'];
            }

            const [doctor_x] = doctor.position;
            if (Math.abs(target_x - doctor_x) > 1) {
                return [false, null, '请选择医生前后两排内的己方墓碑'];
            }

            const cell = board.get_cell(target_x, target_y);
            if (!cell || cell.length === 0) {
                return [false, null, '目标位置没有墓碑'];
            }
            const topPiece = cell[cell.length - 1];
            if (!(topPiece instanceof Grave)) {
                return [false, null, '目标墓碑被其他棋子遮挡，无法复活'];
            }
            if (topPiece.original_team !== doctor.team) {
                return [false, null, '只能复活己方墓碑'];
            }

            let officer_in_zone = false;
            const zone_rows = [0, 1, 10, 11];
            for (const r of zone_rows) {
                for (let c = 0; c < board.size; c++) {
                    const cell_pieces = board.get_cell(r, c);
                    for (const p of cell_pieces) {
                        if (p.name === '官员' && p.team === doctor.team && p.state === 'alive') {
                            officer_in_zone = true;
                            break;
                        }
                    }
                    if (officer_in_zone) break;
                }
                if (officer_in_zone) break;
            }
            const dice_result = DiceEngine.roll_double();
            if (dice_result === 0) {
                doctor.is_frozen = true;
                return [false, dice_result, '骰子00！医生获得永生但失去行动能力'];
            }
            const threshold = officer_in_zone ? 75 : 50;
            const success = dice_result >= threshold;
            if (success) {
                const revived = LifeCycleManager.resurrect_from_grave(board, topPiece, target_x, target_y);
                if (revived) {
                    return [true, dice_result, `✓ 复活成功（${dice_result}≥${threshold}）`];
                }
                return [false, dice_result, '目标墓碑复活处理失败'];
            }
            return [false, dice_result, `✗ 复活失败（${dice_result}<${threshold}）`];
        }

        static police_arrest(board, police, target_x, target_y) {
            const [result_type, dice_num] = roll_for_arrest();
            if (result_type === 'execute') {
                return ['execute', dice_num, `摇到${dice_num.toString().padStart(2, '0')}！枪毙目标`];
            }
            if (result_type === 'arrest') {
                return ['arrest', dice_num, '成功抓捕市民，拘留3回合'];
            }
            return ['fail', dice_num, `抓捕失败（骰子${dice_num.toString().padStart(2, '0')}）`];
        }

        static wife_possess_citizen(board, wife, target_x, target_y) {
            const target_cell = board.get_cell(target_x, target_y);
            if (!target_cell) {
                return [false, null, '目标位置无效'];
            }
            const top_piece = target_cell.length > 0 ? target_cell[target_cell.length - 1] : null;
            if (!top_piece || top_piece.name !== '市民') {
                return [false, null, '目标不是市民'];
            }
            const [result_type, dice_num] = roll_for_possession();
            if (result_type === 'success' || result_type === 'permanent') {
                const [old_x, old_y] = wife.position;
                board.remove_piece(wife, old_x, old_y);
                wife.is_possessed = true;
                wife.is_green_wife = true;
                wife.was_green_wife = true;
                wife.name = '绿叶妻';
                wife.symbol = '绿';
                wife.host_citizen = top_piece;
                board.add_piece(wife, target_x, target_y);
                return [true, dice_num, '附身成功！'];
            }
            return [false, dice_num, '附身失败'];
        }

        static wife_possess(board, wife, target_x, target_y) {
            return SkillManager.wife_possess_citizen(board, wife, target_x, target_y);
        }

        static child_learn_red_song(board, child) {
            // Bug 4 fix: Piper only blocks red song when in child's team back 2 rows
            const piperBlockRows = child.team === 'black' ? [0, 1] : [10, 11];
            for (const r of piperBlockRows) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(r, j);
                    for (const piece of cell) {
                        if (piece.name === '魔笛手' && piece.state === 'alive') {
                            return [false, null, '魔笛手在阵地内，无法学习红歌！'];
                        }
                    }
                }
            }
            let official_alive = false;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.name === '官员' && piece.team === child.team && piece.state === 'alive') {
                            official_alive = true;
                        }
                    }
                }
            }
            const currentBonus = Math.max(0, Math.min(100, child.red_song_bonus || 0));
            const [result_type, dice_num] = roll_for_red_song(official_alive, currentBonus);
            if (result_type === 'permanent') {
                child.learned_red_song = true;
                child.is_red_child = true;
                child.was_red_child = true;
                child.name = '红叶儿';
                child.symbol = '红';
                child.can_jump_grave = false;
                child.red_song_success_count = (child.red_song_success_count || 0) + 1;
                child.red_song_bonus = Math.min(100, currentBonus + 10);
                return [true, dice_num, `终身复读！下次红歌成功率加成+10%（当前加成${child.red_song_bonus}%）`];
            }
            if (result_type === 'success') {
                child.learned_red_song = true;
                child.is_red_child = true;
                child.was_red_child = true;
                child.name = '红叶儿';
                child.symbol = '红';
                child.can_jump_grave = false;
                child.red_song_success_count = (child.red_song_success_count || 0) + 1;
                child.red_song_bonus = Math.min(100, currentBonus + 10);
                return [true, dice_num, `学会唱红歌！下次红歌成功率加成+10%（当前加成${child.red_song_bonus}%）`];
            }
            return [false, dice_num, '学习失败'];
        }

        static teacher_feed(board, teacher, child) {
            if (child.name !== '孩子') {
                return [false, '目标必须是普通孩子'];
            }
            child.has_teacher_buff = true;
            return [true, '老师使用了「热爱喂喂」，孩子下次学红歌概率+10%'];
        }
    }

    class TransformationManager {
        static transform_ye_to_nightmare(board, ye) {
            if (ye.is_nightmare) {
                return [false, null, null, '叶某已经是夜魔状态'];
            }
            if (!ye.check_transformation_conditions(board)) {
                return [false, null, null, '不满足变身条件（妻子附身+孩子学会红歌+到达对方阵地）'];
            }
            return ye.transform_to_nightmare();
        }
        static transform_wife_to_green(board, wife, target_x, target_y) {
            if (wife.is_green_wife) {
                return [false, null, '妻子已经是绿叶妻状态'];
            }
            const [success, dice, msg] = wife.possess_citizen(board, target_x, target_y);
            if (success) {
                return [true, dice, `妻子附身成功，变为绿叶妻！${msg}`];
            }
            return [false, dice, msg];
        }
        static transform_child_to_red(board, child) {
            if (child.is_red_child) {
                return [false, null, '孩子已经是红叶儿状态'];
            }
            const [success, dice, msg] = child.learn_red_song(board);
            if (success) {
                return [true, dice, `孩子学会红歌，变为红叶儿！${msg}`];
            }
            return [false, dice, msg];
        }
        static check_all_transformations(board) {
            const info = { nightmares: [], green_wives: [], red_children: [], transformation_ready: false };
            let has_green_wife = false;
            let has_red_child = false;
            let ye_in_enemy_zone = false;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.name === '叶某' && piece.is_nightmare) {
                            info.nightmares.push({ position: [i, j], team: piece.team, is_night: piece.is_night, duration: piece.nightmare_duration });
                        }
                        if (piece.name === '叶某') {
                            if (piece.team === 'black' && i >= 10) ye_in_enemy_zone = true;
                            if (piece.team === 'white' && i <= 1) ye_in_enemy_zone = true;
                        }
                        if (piece.name === '绿叶妻' || (piece.name === '妻子' && piece.is_green_wife)) {
                            has_green_wife = true;
                            info.green_wives.push({ position: [i, j], team: piece.team, host: piece.host_citizen ? piece.host_citizen.name : null });
                        }
                        if (piece.name === '红叶儿' || (piece.name === '孩子' && piece.is_red_child)) {
                            has_red_child = true;
                            info.red_children.push({ position: [i, j], team: piece.team });
                        }
                    }
                }
            }
            info.transformation_ready = has_green_wife && has_red_child && ye_in_enemy_zone;
            return info;
        }
    }


    class DeathGodManager {
        static find_death_god(board) {
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.name === '死神') {
                            return piece;
                        }
                    }
                }
            }
            return null;
        }

        static roll_death_god_direction(triple_zero_count = 0) {
            const dice = DiceEngine.roll_single();

            if (dice === 0) {
                const new_count = triple_zero_count + 1;
                if (new_count >= 3) {
                    return [dice, null, true, '连续三次0！死神吃掉所有棋子，游戏平局'];
                }
                return [dice, null, false, `死神原地停留（第${new_count}次）`];
            }

            if (dice === 9) {
                return [dice, null, false, '摇到9，需要再摇一次'];
            }

            const direction = DeathGodManager.DIRECTION_MAP[dice];
            const dir_names = {
                1: '左上', 2: '上', 3: '右上',
                4: '左', 5: '右',
                6: '左下', 7: '下', 8: '右下'
            };
            const dir_name = dir_names[dice] || '未知';
            return [dice, direction, false, `死神向${dir_name}移动`];
        }

        static move_death_god(board, death_god, direction) {
            if (!direction) {
                return [false, [], '无效方向'];
            }

            const [x, y] = death_god.position;
            const [dx, dy] = direction;
            const new_x = x + dx;
            const new_y = y + dy;

            if (!board.is_valid_position(new_x, new_y)) {
                board.remove_top_piece(x, y);
                return [true, [death_god], '死神走出棋盘，消失了'];
            }

            const target_cell = board.get_cell(new_x, new_y);
            const eaten_pieces = [];

            for (const piece of target_cell.slice()) {
                LifeCycleManager.banish(board, piece);
                eaten_pieces.push(piece);
            }

            board.remove_top_piece(x, y);
            board.add_piece(death_god, new_x, new_y);

            if (eaten_pieces.length > 0) {
                const eaten_names = eaten_pieces.map(p => p.name);
                return [true, eaten_pieces, `死神吃掉了 ${eaten_names.join(', ')}`];
            }
            return [true, [], '死神移动到空格'];
        }

        static random_move(board, deathgod) {
            let direction_dice = DiceEngine.roll_single();
            let reroll_count = 0;

            while (direction_dice === 9 && reroll_count < 3) {
                direction_dice = DiceEngine.roll_single();
                reroll_count += 1;
            }

            if (direction_dice === 0) {
                DeathGodManager.stay_count += 1;
                if (DeathGodManager.stay_count >= 3) {
                    DeathGodManager.stay_count = 0;
                    return [true, direction_dice, '死神连续停留3次！游戏平局，所有棋子被吞噬'];
                }
                return [true, direction_dice, `死神原地停留（连续${DeathGodManager.stay_count}次）`];
            }

            DeathGodManager.stay_count = 0;

            let direction = DeathGodManager.DIRECTIONS[direction_dice];
            if (!direction || direction === 'reroll') {
                direction = [-1, 0];
            }

            const [x, y] = deathgod.position;
            const [dx, dy] = direction;
            const new_x = x + dx;
            const new_y = y + dy;

            if (!board.is_valid_position(new_x, new_y)) {
                board.remove_piece(deathgod, x, y);
                deathgod.state = 'vanished';
                return [true, direction_dice, '死神走出棋盘，从本局消失'];
            }

            const cell = board.get_cell(new_x, new_y);
            if (cell.length > 0) {
                for (const piece of cell.slice()) {
                    const idx = cell.indexOf(piece);
                    if (idx !== -1) cell.splice(idx, 1);
                    piece.state = 'ghost';
                    board.add_to_ghost_pool(piece);
                }
            }

            board.move_piece(x, y, new_x, new_y);

            const dir_names = ['', '左上', '上', '右上', '左', '右', '左下', '下', '右下'];
            const dir_name = dir_names[direction_dice] || '';
            return [true, direction_dice, `死神向${dir_name}移动到${fmtPos(new_x, new_y)}`];
        }
    }

    DeathGodManager.DIRECTION_MAP = {
        1: [-1, -1],
        2: [-1, 0],
        3: [-1, 1],
        4: [0, -1],
        5: [0, 1],
        6: [1, -1],
        7: [1, 0],
        8: [1, 1]
    };

    DeathGodManager.DIRECTIONS = {
        0: null,
        1: [-1, -1],
        2: [-1, 0],
        3: [-1, 1],
        4: [0, -1],
        5: [0, 1],
        6: [1, -1],
        7: [1, 0],
        8: [1, 1],
        9: 'reroll'
    };

    DeathGodManager.stay_count = 0;

    class OfficerManager {
        static has_adjacent_officer(board, piece) {
            const [x, y] = piece.position;
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (const [dx, dy] of directions) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (board.is_valid_position(new_x, new_y)) {
                    const cell = board.get_cell(new_x, new_y);
                    for (const p of cell) {
                        if (p.name === '官员' && p.team === piece.team && p.state === 'alive') {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        static count_team_officers(board, team) {
            let count = 0;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.name === '官员' && piece.team === team && piece.state === 'alive') {
                            count += 1;
                        }
                    }
                }
            }
            return count;
        }
    }

    class OfficerSkillManager {
        static swap_with_piece(board, source_piece, target_piece) {
            if (!source_piece || !target_piece) {
                return [false, '易位目标无效'];
            }
            if (source_piece.state !== 'alive' || target_piece.state !== 'alive') {
                return [false, '仅存活棋子可执行易位'];
            }
            if (source_piece.team !== target_piece.team) {
                return [false, '只能与同阵营棋子易位'];
            }

            const sourceIsOfficer = source_piece.name === '官员';
            const sourceIsLawyer = source_piece.name === '律师';
            const targetIsOfficer = target_piece.name === '官员';
            const targetIsLawyer = target_piece.name === '律师';
            const legalPair = (sourceIsOfficer && targetIsLawyer) || (sourceIsLawyer && targetIsOfficer);
            if (!legalPair) {
                return [false, '易位仅支持官员与律师互换'];
            }

            const source_pos = source_piece.position.slice();
            const target_pos = target_piece.position.slice();

            board.remove_piece(source_piece, source_pos[0], source_pos[1]);
            board.remove_piece(target_piece, target_pos[0], target_pos[1]);

            source_piece.position = target_pos;
            target_piece.position = source_pos;

            board.add_piece(source_piece, target_pos[0], target_pos[1]);
            board.add_piece(target_piece, source_pos[0], source_pos[1]);

            return [true, `${source_piece.name}与${target_piece.name}互换位置 ${n2a(source_pos[0], source_pos[1])} -> ${n2a(target_pos[0], target_pos[1])}`];
        }

        static summon_ghost(board, officer, target_x, target_y) {
            if (board.ghost_pool.length === 0) {
                return [false, null, '幽灵池为空，无法召唤'];
            }

            if (officer.team === 'black') {
                if (target_x > 1) {
                    return [false, null, '只能在己方阵地(行0-1)召唤市民'];
                }
            } else {
                if (target_x < 10) {
                    return [false, null, '只能在己方阵地(行10-11)召唤市民'];
                }
            }

            if (board.get_cell(target_x, target_y).length > 0) {
                return [false, null, '目标位置必须为空'];
            }

            const dice = DiceEngine.roll_double();

            if (dice === 0) {
                let count = 0;
                const rows = officer.team === 'black' ? [0, 1] : [10, 11];
                for (const ghost of board.ghost_pool.slice()) {
                    if (ghost.team === officer.team) {
                        let placed = false;
                        for (const row of rows) {
                            if (placed) break;
                            for (let col = 0; col < board.size; col++) {
                                if (board.get_cell(row, col).length === 0) {
                                    const new_citizen = create_piece('citizen', officer.team, [row, col]);
                                    board.add_piece(new_citizen, row, col);
                                    board.ghost_pool.splice(board.ghost_pool.indexOf(ghost), 1);
                                    count += 1;
                                    placed = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                return [true, dice, `召唤所有幽灵！共召唤${count}个市民`];
            }

            if (dice >= 50) {
                for (const ghost of board.ghost_pool) {
                    if (ghost.team === officer.team || ghost.original_team === officer.team) {
                        board.ghost_pool.splice(board.ghost_pool.indexOf(ghost), 1);
                        const new_citizen = create_piece('citizen', officer.team, [target_x, target_y]);
                        board.add_piece(new_citizen, target_x, target_y);
                        return [true, dice, `召唤成功！在${fmtPos(target_x, target_y)}召唤了一个市民`];
                    }
                }
                return [false, dice, '没有同阵营的幽灵可召唤'];
            }

            return [false, dice, '召唤失败'];
        }
    }

    class NightmareManager {
        static transform_ye_to_nightmare(board, ye) {
            if (!ye.check_transformation_conditions(board)) {
                return [false, null, '不满足变身条件（需要妻子附身、孩子学红歌、叶某到达敌方阵地）', null];
            }

            const nightmare = new Nightmare(ye.team, ye.position, ye);
            board.remove_piece(ye, ye.position[0], ye.position[1]);
            board.add_piece(nightmare, nightmare.position[0], nightmare.position[1]);

            const [isNight, newDuration, dice, detail] = nightmare.roll_day_night();
            if (!nightmare.permanent_night && isNight) {
                // 变身当回合完成判定后，从下个回合开始稳定持续3个整回合。
                nightmare.night_duration = 4;
                nightmare.nightmare_duration = 4;
            } else {
                nightmare.night_duration = newDuration;
                nightmare.nightmare_duration = newDuration;
            }
            const diceText = (dice === null || dice === undefined) ? '--' : dice.toString().padStart(2, '0');
            const stateMode = nightmare.permanent_night ? 'perm-night' : (isNight ? 'night' : 'day');
            const modeText = stateMode === 'perm-night' ? '永久黑夜' : (stateMode === 'night' ? '黑夜' : '白昼');
            const durationText = nightmare.permanent_night
                ? '永久生效'
                : (isNight ? '下回合起持续3回合' : '本回合生效');
            const rollMeta = {
                source: 'transform',
                dice: Number(dice),
                tens: Number.isFinite(Number(dice)) ? Math.floor(Number(dice) / 10) : null,
                ones: Number.isFinite(Number(dice)) ? (Number(dice) % 10) : null,
                state: stateMode,
                detail: detail || '',
                mode_text: modeText
            };
            return [true, nightmare, `叶某发疯了！变身为夜魔，并立刻进行热爱黑黑判定：${diceText} -> ${modeText}（${detail}，${durationText}）`, rollMeta];
        }

        static execute_day_night_roll(nightmare) {
            return nightmare.roll_day_night();
        }

        static execute_crush_move(board, nightmare, target_x, target_y) {
            if (!nightmare.can_move_now()) {
                return [false, [], '现在是白天，夜魔无法移动'];
            }

            const citizens_to_crush = nightmare.get_crush_targets(board, target_x, target_y);
            const crushed_names = [];

            for (const [citizen, pos] of citizens_to_crush) {
                LifeCycleManager.kill(board, citizen);
                crushed_names.push(`${citizen.name}(${fmtPos(pos[0], pos[1])})`);
            }

            const [old_x, old_y] = nightmare.position;
            board.remove_piece(nightmare, old_x, old_y);
            nightmare.position = [target_x, target_y];
            board.add_piece(nightmare, target_x, target_y);

            const msg = crushed_names.length > 0
                ? `夜魔碾压前进！吃掉了: ${crushed_names.join(', ')}`
                : `夜魔移动到${fmtPos(target_x, target_y)}`;

            return [true, citizens_to_crush, msg];
        }

        static restore_nightmare_to_ye(board, nightmare) {
            if (!nightmare.original_ye) {
                return [false, null, '无法恢复：找不到原始叶某'];
            }

            const ye = nightmare.original_ye;
            board.remove_piece(nightmare, nightmare.position[0], nightmare.position[1]);

            ye.is_nightmare = false;
            ye.position = ye.initial_position;
            ye.state = 'alive';

            board.add_piece(ye, ye.initial_position[0], ye.initial_position[1]);
            return [true, ye, '夜魔恢复为叶某，回到初始位置'];
        }
    }

    class MonkManager {
        static _findPieceByUid(board, uid) {
            const target = Number(uid);
            if (!Number.isFinite(target)) return null;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (Number(ensureUid(piece)) === target) return piece;
                    }
                }
            }
            for (const piece of board.ghost_pool || []) {
                if (Number(ensureUid(piece)) === target) return piece;
            }
            return null;
        }

        static reconcile_monk_locks(board) {
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (!(piece instanceof Monk)) continue;
                        if (!piece.active_saved_uid) continue;
                        const saved = MonkManager._findPieceByUid(board, piece.active_saved_uid);
                        if (!saved || saved.state !== 'alive' || !saved.is_saved) {
                            piece.active_saved_uid = null;
                        }
                    }
                }
            }
        }

        static release_lock_for_piece(board, target_piece) {
            const targetUid = ensureUid(target_piece);
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece instanceof Monk && Number(piece.active_saved_uid) === Number(targetUid)) {
                            piece.active_saved_uid = null;
                        }
                    }
                }
            }
        }

        static save_piece(board, monk, target_piece) {
            if (!target_piece || target_piece.state !== 'alive') {
                return [false, null, '目标无效'];
            }
            if (target_piece.name === '死神') {
                return [false, null, '技能不能以死神为目标'];
            }
            if (target_piece.is_saved || target_piece.state === 'monk_forever') {
                return [false, null, `${target_piece.name}已在修行状态`];
            }

            MonkManager.reconcile_monk_locks(board);
            if (monk.active_saved_uid) {
                return [false, null, '僧侣一次只能存档一个棋子，请等待其修行结束'];
            }

            target_piece.is_saved = true;
            target_piece.save_duration = 3;
            target_piece.save_position = Array.isArray(target_piece.position) ? target_piece.position.slice() : null;
            target_piece.just_saved = false;
            target_piece.just_saved_turns = 0;

            const oldPos = Array.isArray(target_piece.position) ? target_piece.position.slice() : null;
            if (oldPos && (oldPos[0] !== monk.position[0] || oldPos[1] !== monk.position[1])) {
                board.remove_piece(target_piece, oldPos[0], oldPos[1]);
                board.add_piece(target_piece, monk.position[0], monk.position[1]);
            }

            monk.active_saved_uid = ensureUid(target_piece);
            return [true, null, `${target_piece.name}开始修行（固定3回合）`];
        }

        static end_save(board, piece) {
            if (piece.is_saved) {
                piece.is_saved = false;
                piece.save_duration = 0;
                piece.just_saved = false;
                piece.just_saved_turns = 0;

                if (piece.save_position) {
                    const old_pos = piece.position;
                    board.remove_piece(piece, old_pos[0], old_pos[1]);
                    piece.position = piece.save_position;
                    board.add_piece(piece, piece.save_position[0], piece.save_position[1]);
                }
                piece.save_position = null;
                MonkManager.release_lock_for_piece(board, piece);

                return true;
            }
            return false;
        }
    }

    class MoleManager {
        static is_empty_cell(board, x, y) {
            if (!board.is_valid_position(x, y)) return false;
            const cell = board.get_cell(x, y);
            return !!(cell && cell.length === 0);
        }

        static is_adjacent8(target_piece, start_x, start_y) {
            if (!target_piece || !Array.isArray(target_piece.position)) return false;
            const [tx, ty] = target_piece.position;
            const dx = Math.abs(start_x - tx);
            const dy = Math.abs(start_y - ty);
            return (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0));
        }

        static is_cross_line(start_x, start_y, end_x, end_y) {
            if (start_x === end_x && start_y === end_y) return false;
            return start_x === end_x || start_y === end_y || Math.abs(start_x - end_x) === Math.abs(start_y - end_y);
        }

        static validate_tunnel_path_v2(board, target_piece, start_x, start_y, end_x, end_y) {
            if (!target_piece || target_piece.state !== 'alive') {
                return [false, '目标棋子无效'];
            }
            if (!board.is_valid_position(start_x, start_y) || !board.is_valid_position(end_x, end_y)) {
                return [false, '地道坐标超出棋盘范围'];
            }
            if (!MoleManager.is_adjacent8(target_piece, start_x, start_y)) {
                return [false, '地道起点必须是目标棋子周边8邻域空位'];
            }
            if (!MoleManager.is_cross_line(start_x, start_y, end_x, end_y)) {
                return [false, '地道终点必须与起点呈横/竖/斜直线方向'];
            }
            if (!MoleManager.is_empty_cell(board, start_x, start_y)) {
                return [false, '地道起点必须是空格'];
            }
            if (!MoleManager.is_empty_cell(board, end_x, end_y)) {
                return [false, '地道终点必须是空格'];
            }
            return [true, 'ok'];
        }

        static summon_mole(board, caller_piece) {
            const dice = DiceEngine.roll_double();

            let mole = null;
            let mole_pos = null;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.name === '鼹鼠') {
                            mole = piece;
                            mole_pos = [i, j];
                            break;
                        }
                    }
                }
            }

            if (!mole) {
                return [false, dice, null, '场上没有鼹鼠'];
            }

            if (dice === 0) {
                const destroyed = MoleManager.destroy_all_graves(board);
                return [true, dice, mole_pos, `爆破鼹鼠出现！破坏了场上所有${destroyed}座墓`];
            }

            if (dice >= 50) {
                const [x, y] = caller_piece.position;
                const directions = [
                    [-1, 0], [1, 0], [0, -1], [0, 1],
                    [-1, -1], [-1, 1], [1, -1], [1, 1]
                ];

                for (const [dx, dy] of directions) {
                    const new_x = x + dx;
                    const new_y = y + dy;
                    if (board.is_valid_position(new_x, new_y)) {
                        if (board.get_cell(new_x, new_y).length === 0) {
                            board.move_piece(mole_pos[0], mole_pos[1], new_x, new_y);
                            return [true, dice, [new_x, new_y], `召唤鼹鼠成功，鼹鼠移动到${fmtPos(new_x, new_y)}`];
                        }
                    }
                }

                return [false, dice, null, '召唤者周围没有空位'];
            }

            return [false, dice, null, '召唤鼹鼠失败'];
        }

        // Rulebook 11.1: target adjacent empty start + cross-line empty end; tunnel can pass through blockers.
        static dig_tunnel_v2(board, mole, target_piece, start_x, start_y, end_x, end_y) {
            const valid = MoleManager.validate_tunnel_path_v2(board, target_piece, start_x, start_y, end_x, end_y);
            if (!valid[0]) return valid;

            const moved = board.move_specific_piece(target_piece, end_x, end_y);
            if (!moved) {
                return [false, '传送执行失败'];
            }
            const mole_init_pos = Array.isArray(mole.initial_position) ? mole.initial_position : mole.position;
            board.move_specific_piece(mole, mole_init_pos[0], mole_init_pos[1]);
            return [true, `${target_piece.name}通过地道从${fmtPos(start_x, start_y)}传送到${fmtPos(end_x, end_y)}，鼹鼠回到原位`];
        }

        static dig_tunnel(board, mole, target_piece, end_x, end_y) {
            if (board.get_cell(end_x, end_y).length > 0) {
                return [false, '地道终点必须是空格'];
            }

            const [start_x, start_y] = mole.position;
            if (start_x !== end_x && start_y !== end_y) {
                const dx = end_x - start_x;
                const dy = end_y - start_y;
                if (Math.abs(dx) !== Math.abs(dy)) {
                    return [false, '地道起点和终点必须呈直线（横/竖/斜）'];
                }
            }

            const old_pos = target_piece.position;
            board.move_specific_piece(target_piece, end_x, end_y);

            const mole_init_pos = Array.isArray(mole.initial_position) ? mole.initial_position : mole.position;
            board.move_specific_piece(mole, mole_init_pos[0], mole_init_pos[1]);

            return [true, `${target_piece.name}通过地道移动到${fmtPos(end_x, end_y)}，鼹鼠回到原位`];
        }

        static destroy_grave(board, grave_x, grave_y) {
            const cell = board.get_cell(grave_x, grave_y);
            for (const piece of cell.slice()) {
                if (piece instanceof Grave) {
                    const idx = cell.indexOf(piece);
                    if (idx !== -1) cell.splice(idx, 1);
                    board.add_to_ghost_pool(piece.original_piece);
                    return [true, `破坏了${piece.original_name}的墓`];
                }
            }
            return [false, '该位置没有墓'];
        }

        static destroy_all_graves(board) {
            let count = 0;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell.slice()) {
                        if (piece instanceof Grave) {
                            const idx = cell.indexOf(piece);
                            if (idx !== -1) cell.splice(idx, 1);
                            board.add_to_ghost_pool(piece.original_piece);
                            count += 1;
                        }
                    }
                }
            }
            return count;
        }
    }

    class SquareDancerManager {
        static is_green_wife(piece) {
            return !!(piece && (piece.is_green_wife || piece.name === '绿叶妻'));
        }

        static resolveDirectionDiceForDance() {
            let direction_dice = DiceEngine.roll_single();
            let reroll_count = 0;
            while (direction_dice === 9 && reroll_count < 3) {
                direction_dice = DiceEngine.roll_single();
                reroll_count += 1;
            }
            if (direction_dice === 9) {
                direction_dice = 1;
            }
            return direction_dice;
        }

        static resolveDirectionDiceWithRerollTrace() {
            const rolls = [];
            let direction_dice = DiceEngine.roll_single();
            rolls.push(direction_dice);
            while (direction_dice === 9) {
                direction_dice = DiceEngine.roll_single();
                rolls.push(direction_dice);
            }
            return { direction_dice, rolls };
        }

        static findFarthestReachable(board, start_pos, dx, dy) {
            let [x, y] = start_pos;
            while (true) {
                const new_x = x + dx;
                const new_y = y + dy;
                if (!board.is_valid_position(new_x, new_y)) {
                    break;
                }
                if (board.get_cell(new_x, new_y).length > 0) {
                    break;
                }
                x = new_x;
                y = new_y;
            }
            return [x, y];
        }

        static collectDanceGroup(board, target_piece) {
            if (!target_piece || !Array.isArray(target_piece.position)) return [];
            const [x, y] = target_piece.position;
            const cell = board.get_cell(x, y) || [];
            if (!SquareDancerManager.is_green_wife(target_piece)) {
                return [target_piece];
            }
            // 规则书10.4：绿叶妻同格叠层时，除妻子外全部共舞位移。
            return cell.filter(p => p !== target_piece);
        }

        static restoreGreenWife(board, wife_piece) {
            if (!wife_piece) return;
            board.remove_specific_piece(wife_piece);
            wife_piece.is_possessed = false;
            wife_piece.is_green_wife = false;
            wife_piece.name = '妻子';
            wife_piece.symbol = '妻';
            wife_piece.host_citizen = null;
            const init_pos = Array.isArray(wife_piece.initial_position) ? wife_piece.initial_position : wife_piece.position;
            board.add_piece(wife_piece, init_pos[0], init_pos[1]);
        }

        static vortex_pull(board, squaredancer, target_piece) {
            if (!target_piece || target_piece.state !== 'alive') {
                return [false, null, '目标无效', null];
            }
            if (target_piece === squaredancer) {
                return [false, null, '不能对广场舞大妈自身使用该技能', null];
            }
            if (target_piece.team === 'neutral') {
                return [false, null, '广场舞大妈不能对中立棋子使用技能', null];
            }

            const isGreenWifeTarget = SquareDancerManager.is_green_wife(target_piece);
            const danceGroup = SquareDancerManager.collectDanceGroup(board, target_piece);
            const dancerStartPos = squaredancer.position.slice();
            const groupLabel = danceGroup.length === 1
                ? danceGroup[0].name
                : `共舞棋子(${danceGroup.length})`;
            const pullDanceGroupToDancer = () => {
                for (const p of danceGroup) {
                    if (!p || !Array.isArray(p.position)) continue;
                    if (p.position[0] !== dancerStartPos[0] || p.position[1] !== dancerStartPos[1]) {
                        board.move_specific_piece(p, dancerStartPos[0], dancerStartPos[1]);
                    }
                }
            };

            const dice = DiceEngine.roll_double();

            if (dice === 0) {
                pullDanceGroupToDancer();
                target_piece.is_in_vortex_forever = true;
                return [true, dice, `${target_piece.name}被永久吸入广场舞旋涡`, null];
            }

            if (dice >= 50) {
                pullDanceGroupToDancer();
                // 两阶段流程B：从大妈原位开始，按方向骰进行随机飞行。
                const direction_dice = SquareDancerManager.resolveDirectionDiceForDance();
                if (direction_dice === 0) {
                    // direction_dice=0: 共舞棋子回到各自原位；绿叶妻解除附身回初始位。
                    for (const p of danceGroup) {
                        const init_pos = Array.isArray(p.initial_position) ? p.initial_position : p.position;
                        if (init_pos) {
                            board.move_specific_piece(p, init_pos[0], init_pos[1]);
                        }
                    }
                    if (isGreenWifeTarget) {
                        SquareDancerManager.restoreGreenWife(board, target_piece);
                        return [true, dice, `绿叶妻解除附身并回到初始位置；${groupLabel}被旋涡弹回原位`, direction_dice];
                    }
                    const init_pos = Array.isArray(target_piece.initial_position) ? target_piece.initial_position : target_piece.position;
                    return [true, dice, `${target_piece.name}被吸入后弹回初始位置${fmtPos(init_pos[0], init_pos[1])}`, direction_dice];
                }

                const direction = SquareDancerManager.DIRECTIONS[direction_dice];
                if (!direction || direction === 'reroll') {
                    return [false, dice, '方向判定异常', direction_dice];
                }

                const [dx, dy] = direction;
                const [x, y] = SquareDancerManager.findFarthestReachable(board, dancerStartPos, dx, dy);
                const moved = x !== dancerStartPos[0] || y !== dancerStartPos[1];

                if (isGreenWifeTarget) {
                    SquareDancerManager.restoreGreenWife(board, target_piece);
                }

                if (moved) {
                    for (const p of danceGroup) {
                        if (p.position[0] !== x || p.position[1] !== y) {
                            board.move_specific_piece(p, x, y);
                        }
                    }
                    board.move_specific_piece(squaredancer, x, y);

                    const dir_names = { 1: '↖', 2: '↑', 3: '↗', 4: '←', 5: '→', 6: '↙', 7: '↓', 8: '↘' };
                    const prefix = isGreenWifeTarget ? '绿叶妻解除附身并回到初始位置；' : '';
                    const msg = `${prefix}广场舞大妈和${groupLabel}一起被旋涡带到${fmtPos(x, y)}，方向${dir_names[direction_dice] || ''}`;

                    return [true, dice, msg, direction_dice];
                }

                if (isGreenWifeTarget) {
                    return [true, dice, `绿叶妻解除附身并回到初始位置；${groupLabel}处在边界或被阻挡无法移动`, direction_dice];
                }
                return [true, dice, `${target_piece.name}处在边界或被阻挡无法移动`, direction_dice];
            }

            return [false, dice, `${target_piece.name}没有被吸入旋涡`, null];
        }
    }

    SquareDancerManager.DIRECTIONS = {
        0: null,        // 回到原位
        1: [-1, -1],    // ↖ 左上方
        2: [-1, 0],     // ↑ 正上方
        3: [-1, 1],     // ↗ 右上方
        4: [0, -1],     // ← 正左方
        5: [0, 1],      // → 正右方
        6: [1, -1],     // ↙ 左下方
        7: [1, 0],      // ↓ 正下方
        8: [1, 1],      // ↘ 右下方
        9: 'reroll'     // 再摇一次
    };

    class PoliceManager {
        static resolveReleasePosition(piece) {
            if (!piece) return [0, 0];
            if (Array.isArray(piece.arrest_release_pos) && piece.arrest_release_pos.length === 2) {
                return piece.arrest_release_pos.slice();
            }
            if (piece.name === '夜魔' && piece.original_ye && Array.isArray(piece.original_ye.initial_position)) {
                return piece.original_ye.initial_position.slice();
            }
            if (Array.isArray(piece.initial_position) && piece.initial_position.length === 2) {
                return piece.initial_position.slice();
            }
            if (Array.isArray(piece.position) && piece.position.length === 2) {
                return piece.position.slice();
            }
            return [0, 0];
        }

        static arrest(board, police, target_piece) {
            const valid_targets = ['魔笛手', '夜魔'];
            if (valid_targets.indexOf(target_piece.name) === -1) {
                return [false, null, `只能抓捕魔笛手或夜魔，不能抓捕${target_piece.name}`];
            }

            const dice = DiceEngine.roll_double();

            if (dice === 0) {
                target_piece.state = 'ghost';
                const [x, y] = target_piece.position;
                board.remove_piece(target_piece, x, y);
                board.add_to_ghost_pool(target_piece);

                if (target_piece.name === '夜魔') {
                    return [true, dice, '夜魔被枪决！变成幽灵'];
                }
                return [true, dice, '魔笛手被枪决，变成幽灵'];
            }

            if (dice >= 50) {
                target_piece.is_arrested = true;
                target_piece.arrest_duration = 3;
                target_piece.can_use_skills = false;
                target_piece.arrest_release_pos = PoliceManager.resolveReleasePosition(target_piece);
                police.arrested_piece = target_piece;

                const [x, y] = target_piece.position;
                board.remove_piece(target_piece, x, y);
                target_piece.position = police.position;

                return [true, dice, `抓捕成功！${target_piece.name}被拘留3回合`];
            }

            return [false, dice, '抓捕失败'];
        }

        static release_arrested(board, police) {
            if (police.arrested_piece) {
                const piece = police.arrested_piece;
                const releasePos = PoliceManager.resolveReleasePosition(piece);

                if (piece.name === '夜魔' && piece.original_ye) {
                    const ye = piece.original_ye;
                    ye.is_nightmare = false;
                    ye.name = '叶某';
                    ye.symbol = '叶';
                    ye.is_night = false;
                    ye.night_duration = 0;
                    ye.nightmare_duration = 0;
                    ye.permanent_night = false;
                    ye.state = 'alive';
                    ye.is_arrested = false;
                    ye.arrest_duration = 0;
                    ye.can_use_skills = true;
                    ye.position = releasePos.slice();
                    ye.arrest_release_pos = null;
                    board.add_piece(ye, releasePos[0], releasePos[1]);
                } else {
                    piece.is_arrested = false;
                    piece.arrest_duration = 0;
                    piece.can_use_skills = true;
                    if (piece.name === '夜魔') {
                        piece.is_nightmare = false;
                        piece.name = '叶某';
                        piece.symbol = '叶';
                        piece.is_night = false;
                        piece.night_duration = 0;
                        piece.nightmare_duration = 0;
                        piece.permanent_night = false;
                    }
                    piece.position = releasePos.slice();
                    piece.arrest_release_pos = null;
                    board.add_piece(piece, releasePos[0], releasePos[1]);
                }

                police.arrested_piece = null;
                return true;
            }
            return false;
        }
    }

    class CitizenManager {
        static citizen_upgrade(board, citizen, target_type) {
            const valid_types = ['officer', 'police', 'lawyer', 'teacher', 'doctor'];
            if (valid_types.indexOf(target_type) === -1) {
                return [false, `市民只能升变为 ${valid_types.join(', ')}`];
            }
            if (isCitizenHostedByGreenWife(board, citizen)) {
                return [false, '该市民处于绿叶妻附身状态，不能升变'];
            }

            if (!citizen.check_upgrade_condition(board)) {
                return [false, '市民未满足升变条件（需要到达对方底线）'];
            }

            const pos = citizen.position;
            const new_piece = create_piece(target_type, citizen.team, pos);

            board.remove_piece(citizen, pos[0], pos[1]);
            board.add_piece(new_piece, pos[0], pos[1]);

            const type_names = {
                officer: '官员',
                police: '警察',
                lawyer: '律师',
                teacher: '老师',
                doctor: '医生'
            };

            const msg = `市民升变为${type_names[target_type] || target_type}`;
            return [true, msg];
        }

        static check_v_formation(board, team, containing_piece = null) {
            const citizens = [];
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.name === '市民' && piece.team === team && piece.state === 'alive') {
                            citizens.push(piece);
                        }
                    }
                }
            }

            if (citizens.length < 3) {
                return [false, [], null];
            }

            citizens.sort((a, b) => (a.position[0] - b.position[0]) || (a.position[1] - b.position[1]));

            // Forward direction for team (Black: +1, White: -1)
            const teamDir = team === 'black' ? 1 : -1;

            for (const size of [7, 5, 3]) {
                if (citizens.length < size) continue;

                // Check both orientations: Wings Ahead (dir=1) and Wings Behind (dir=-1) relative to team properties
                // We pass the actual row offset to _find_v_formation
                const orientations = [teamDir, -teamDir];

                for (const rowOffset of orientations) {
                    const formation = CitizenManager._find_v_formation(citizens, size, rowOffset);
                    if (formation) {
                        // If we are looking for a specific piece, ensure it's in the formation
                        if (containing_piece) {
                            const found = formation.some(p => p === containing_piece);
                            if (found) {
                                return [true, formation, `V${size}`];
                            }
                            // If not found, continue searching other formations/orientations
                        } else {
                            return [true, formation, `V${size}`];
                        }
                    }
                }
            }

            return [false, [], null];
        }

        static _find_v_formation(citizens, size, rowOffset) {
            for (const leader of citizens) {
                const perimeter = [leader];
                const [lx, ly] = leader.position;

                // Step 1: Build V perimeter and track boundaries
                const rows = [lx];
                const leftCols = [ly];
                const rightCols = [ly];

                if (size >= 3) {
                    const rowOffset1 = rowOffset;
                    const pos1 = [lx + rowOffset1, ly - 1];
                    const pos2 = [lx + rowOffset1, ly + 1];

                    const c1 = citizens.find(c => c.position[0] === pos1[0] && c.position[1] === pos1[1]);
                    const c2 = citizens.find(c => c.position[0] === pos2[0] && c.position[1] === pos2[1]);

                    if (c1 && c2) {
                        perimeter.push(c1, c2);
                        rows.push(lx + rowOffset1);
                        leftCols.push(ly - 1);
                        rightCols.push(ly + 1);

                        if (size === 3) {
                            return CitizenManager._complete_formation(citizens, perimeter, rows, leftCols, rightCols);
                        }

                        if (size >= 5) {
                            const rowOffset2 = rowOffset * 2;
                            const pos3 = [lx + rowOffset2, ly - 2];
                            const pos4 = [lx + rowOffset2, ly + 2];

                            const c3 = citizens.find(c => c.position[0] === pos3[0] && c.position[1] === pos3[1]);
                            const c4 = citizens.find(c => c.position[0] === pos4[0] && c.position[1] === pos4[1]);

                            if (c3 && c4) {
                                perimeter.push(c3, c4);
                                rows.push(lx + rowOffset2);
                                leftCols.push(ly - 2);
                                rightCols.push(ly + 2);

                                if (size === 5) {
                                    return CitizenManager._complete_formation(citizens, perimeter, rows, leftCols, rightCols);
                                }

                                if (size >= 7) {
                                    const rowOffset3 = rowOffset * 3;
                                    const pos5 = [lx + rowOffset3, ly - 3];
                                    const pos6 = [lx + rowOffset3, ly + 3];

                                    const c5 = citizens.find(c => c.position[0] === pos5[0] && c.position[1] === pos5[1]);
                                    const c6 = citizens.find(c => c.position[0] === pos6[0] && c.position[1] === pos6[1]);

                                    if (c5 && c6) {
                                        perimeter.push(c5, c6);
                                        rows.push(lx + rowOffset3);
                                        leftCols.push(ly - 3);
                                        rightCols.push(ly + 3);

                                        return CitizenManager._complete_formation(citizens, perimeter, rows, leftCols, rightCols);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return null;
        }

        static _complete_formation(citizens, perimeter, rows, leftCols, rightCols) {
            // Step 2: Find ALL inner citizens within V boundaries
            const formation = [...perimeter];
            const innerCitizens = [];

            // Scan all positions inside V shape
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const leftBound = leftCols[i];
                const rightBound = rightCols[i];

                // Check all columns between left and right wing (inclusive)
                for (let col = leftBound; col <= rightBound; col++) {
                    // Skip if already in perimeter
                    const alreadyInPerimeter = perimeter.some(p =>
                        p.position[0] === row && p.position[1] === col
                    );
                    if (alreadyInPerimeter) {
                        continue;
                    }

                    // Find citizen at this position
                    const innerCitizen = citizens.find(c =>
                        c.position[0] === row &&
                        c.position[1] === col
                    );

                    if (innerCitizen) {
                        innerCitizens.push(innerCitizen);
                    }
                }
            }

            // Step 3: Add all inner citizens to formation
            formation.push(...innerCitizens);

            // Step 4: Validate formation integrity - all pieces must be alive
            // If any piece is dead/grave/ghost, formation is broken
            const allAlive = formation.every(c => c.state === 'alive');
            if (!allAlive) {
                return null; // Formation broken
            }

            return formation;
        }

        static move_v_formation(board, formation, team) {
            const dx = team === 'black' ? 1 : -1;

            let can_move = true;
            for (const citizen of formation) {
                const [x, y] = citizen.position;
                const new_x = x + dx;

                if (!board.is_valid_position(new_x, y)) {
                    can_move = false;
                    break;
                }

                if (board.get_cell(new_x, y).length > 0) {
                    can_move = false;
                    break;
                }
            }

            if (!can_move) {
                return [false, 'V阵型无法集体移动'];
            }

            if (team === 'black') {
                formation.sort((a, b) => b.position[0] - a.position[0]);
            } else {
                formation.sort((a, b) => a.position[0] - b.position[0]);
            }

            for (const citizen of formation) {
                const [x, y] = citizen.position;
                board.move_piece(x, y, x + dx, y);
            }

            return [true, `V阵型${formation.length}人集体前进！`];
        }

        static check_surround(board, target_x, target_y, team) {
            const directions = [
                [-1, 0], [1, 0], [0, -1], [0, 1],
                [-1, -1], [-1, 1], [1, -1], [1, 1]
            ];

            const surrounding_citizens = [];
            const cross_citizens = [];

            for (const [dx, dy] of directions) {
                const x = target_x + dx;
                const y = target_y + dy;
                if (board.is_valid_position(x, y)) {
                    const cell = board.get_cell(x, y);
                    for (const piece of cell) {
                        if (piece.name === '市民' && piece.team === team) {
                            surrounding_citizens.push(piece);
                            if ((dx === 0 && Math.abs(dy) === 1) || (dy === 0 && Math.abs(dx) === 1)) {
                                cross_citizens.push(piece);
                            }
                        }
                    }
                }
            }

            if (cross_citizens.length >= 4) {
                return ['cross', cross_citizens];
            }

            // Bug 8 fix: Triangle surround requires 3 of 4 cardinal directions
            // (not any 3 of 8 adjacent cells)
            if (cross_citizens.length >= 3) {
                return ['triangle', cross_citizens.slice(0, 3)];
            }

            return [null, []];
        }

        static apply_surround_effect(board, target_piece, surround_type, surrounding_citizens) {
            if (surround_type === 'cross') {
                const pos = target_piece.position;
                board.remove_piece(target_piece, pos[0], pos[1]);
                const grave = new Grave(target_piece);
                board.add_piece(grave, pos[0], pos[1]);
                return [true, `市民十字包围，${target_piece.name}被击杀`];
            }

            if (surround_type === 'triangle') {
                target_piece.is_frozen = true;
                target_piece.frozen_by = surrounding_citizens;
                return [true, `市民三角包围，${target_piece.name}无法动弹`];
            }

            return [false, '无包围效果'];
        }

        static is_in_v_formation(board, piece) {
            if (piece.name !== '市民') {
                return [false, []];
            }

            const [has_v, formation] = CitizenManager.check_v_formation(board, piece.team, piece);
            if (has_v) {
                return [true, formation];
            }
            return [false, []];
        }

        static is_piece_frozen(piece) {
            return !!piece.is_frozen;
        }

        static check_formation_after_move(board, moved_piece) {
            const effects = [];
            if (moved_piece.name !== '市民') {
                return effects;
            }

            const team = moved_piece.team;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.team !== team && piece.team !== 'neutral' && piece.state === 'alive') {
                            const [surround_type, citizens] = CitizenManager.check_surround(board, i, j, team);
                            if (surround_type) {
                                effects.push([piece, surround_type, citizens]);
                            }
                        }
                    }
                }
            }

            return effects;
        }

        static update_frozen_status(board) {
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.is_frozen) {
                            const frozen_by = piece.frozen_by || [];
                            let still_surrounded = true;

                            for (const citizen of frozen_by) {
                                if (citizen.state !== 'alive') {
                                    still_surrounded = false;
                                    break;
                                }
                            }

                            if (still_surrounded) {
                                const enemy_team = piece.team === 'black' ? 'white' : 'black';
                                const [surround_type] = CitizenManager.check_surround(board, i, j, enemy_team);
                                if (!surround_type) {
                                    still_surrounded = false;
                                }
                            }

                            if (!still_surrounded) {
                                piece.is_frozen = false;
                                piece.frozen_by = [];
                            }
                        }
                    }
                }
            }
        }
    }

    class LawyerManager {
        static is_immune(lawyer, skill_type) {
            if (lawyer.name !== '律师') return false;
            const immune_skills = ['squaredancer', 'piper', 'monk'];
            return immune_skills.indexOf(skill_type) !== -1;
        }
    }

    class PiperManager {
        static check_and_cancel_red_song(board, piper) {
            const [x] = piper.position;
            const in_black_territory = x <= 1;
            const in_white_territory = x >= 10;

            if (!in_black_territory && !in_white_territory) {
                return [false, '魔笛手不在任何阵地内'];
            }

            const target_team = in_black_territory ? 'black' : 'white';
            const cancelled = [];

            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.team === target_team && piece.is_red_child) {
                            piece.is_red_child = false;
                            piece.name = '孩子';
                            piece.symbol = '子';
                            piece.can_jump_grave = true;
                            piece.learned_red_song = false;
                            cancelled.push(piece);
                        }
                    }
                }
            }

            if (cancelled.length > 0) {
                return [true, `魔笛手解除了${cancelled.length}个红叶儿的红歌状态！`];
            }

            return [false, '没有红叶儿需要解除'];
        }

        static destiny_dice(board, piper, target_pieces, force_success = true, owner_turn = null) {
            const dice = DiceEngine.roll_double();

            let max_targets = 0;
            if (dice === 0) {
                max_targets = 3;
            } else if (dice >= 50) {
                max_targets = 1;
            } else {
                return [false, dice, '命运骰失败'];
            }

            const affected = [];
            for (const piece of target_pieces.slice(0, max_targets)) {
                if (piece.name === '魔笛手') {
                    continue;
                }
                piece.destiny_dice_active = true;
                piece.destiny_dice_success = force_success;
                piece.destiny_dice_owner_turn = owner_turn;
                affected.push(piece.name);
            }

            const result = force_success ? '成功' : '失败';
            return [true, dice, `命运骰生效！${affected.join(', ')}下次判定必定${result}`];
        }
    }

    function capture_piece(board, attacker, target_x, target_y) {
        const target_cell = board.get_cell(target_x, target_y);
        if (!target_cell || target_cell.length === 0) {
            return [false, '目标位置为空'];
        }

        if (attacker.name !== '死神' && isPublicPiece(attacker)) {
            return [false, `${attacker.name}不能进行常规吃子`];
        }
        const top_piece = target_cell[target_cell.length - 1];
        const target_piece = resolveCaptureTargetFromCell(attacker, target_cell);
        if (!target_piece) {
            if (attacker.name !== '死神' && top_piece && top_piece.name === '广场舞大妈') {
                return [false, '该叠层中没有可吃目标（广场舞大妈不可被常规吃子）'];
            }
            if (attacker.name !== '死神' && top_piece && isPublicPiece(top_piece)) {
                return [false, `普通棋子不能吃掉公共棋子${top_piece.name}`];
            }
            return [false, `${attacker.name} 无法吃掉 ${top_piece ? top_piece.name : '目标棋子'}`];
        }

        // Bug 13 fix: When capturing green wife, only host citizen dies, wife returns to start
        if (target_piece.is_green_wife || target_piece.name === '绿叶妻') {
            const host = target_piece.host_citizen;
            if (host) {
                board.remove_specific_piece(host);
                host.state = 'dead';
                const grave = new Grave(host);
                grave.position = [target_x, target_y];
                board.remove_piece(target_piece, target_x, target_y);
                board.add_piece(grave, target_x, target_y);
            } else {
                board.remove_piece(target_piece, target_x, target_y);
            }
            // Wife returns to starting position unharmed
            target_piece.is_possessed = false;
            target_piece.is_green_wife = false;
            target_piece.name = '妻子';
            target_piece.symbol = '妻';
            target_piece.host_citizen = null;
            board.add_piece(target_piece, target_piece.initial_position[0], target_piece.initial_position[1]);
            // Move attacker to position
            board.move_specific_piece(attacker, target_x, target_y);
            return [true, `${attacker.name} 击杀了附身市民，妻子回到原位`];
        }

        board.remove_piece(target_piece, target_x, target_y);
        const grave = LifeCycleManager.kill_piece(board, target_piece, target_x, target_y);
        board.add_piece(grave, target_x, target_y);
        board.move_specific_piece(attacker, target_x, target_y);
        return [true, `${attacker.name} 吃掉了 ${target_piece.name}`];
    }

    class Game {
        constructor() {
            this.board = new Board();
            this.current_turn = null;
            this.turn_count = 0;
            this.death_god_zero_count = 0;
            this.game_over = false;
            this.winner = null;
            this.win_reason = null;
            this.phase = 'PRE_GAME';
            this.skill_cooldowns = {};
            this.state_durations = {};
            this.action_taken = null;
            this.log_history = [];
            this.sandbox_mode = false;
            this.last_round_tick = 0;
            this.team_swap_used = { black: false, white: false };
            this.team_progress = {
                black: { wife_ready: false, child_ready: false },
                white: { wife_ready: false, child_ready: false }
            };
            this.v_formations = {};
            this.next_v_formation_id = 1;
            this.nightmare_first_transform_done = false;
        }

        clone() {
            const prevUid = Piece._next_uid;
            const snapshot = serializeGame(this);
            const cloned = deserializeGame(snapshot);
            Piece._next_uid = prevUid;
            return cloned;
        }

        toggle_sandbox(enabled) {
            this.sandbox_mode = !!enabled;
            return this.sandbox_mode;
        }

        get_round_count() {
            return Math.max(1, Math.ceil((this.turn_count || 0) / 2));
        }

        _findPieceByUid(uid) {
            const target = Number(uid);
            if (!Number.isFinite(target)) return null;
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    for (const piece of cell) {
                        if (Number(ensureUid(piece)) === target) return piece;
                    }
                }
            }
            for (const piece of this.board.ghost_pool || []) {
                if (Number(ensureUid(piece)) === target) return piece;
            }
            return null;
        }

        _getPieceFromCell(cell, piece_id = null) {
            if (!cell || cell.length === 0) return null;
            if (piece_id === null || piece_id === undefined) {
                return cell[cell.length - 1];
            }
            const target = Number(piece_id);
            if (!Number.isFinite(target)) return null;
            for (let i = cell.length - 1; i >= 0; i -= 1) {
                const piece = cell[i];
                if (Number(ensureUid(piece)) === target) {
                    return piece;
                }
            }
            return null;
        }

        _findAttachedGreenWife(citizen) {
            if (!citizen || citizen.name !== '市民' || !Array.isArray(citizen.position)) return null;
            const [x, y] = citizen.position;
            const cell = this.board.get_cell(x, y);
            if (!cell || !cell.length) return null;
            return cell.find(p => p && p.is_green_wife && p.host_citizen === citizen) || null;
        }

        _isPieceOnBoard(piece) {
            if (!piece || !Array.isArray(piece.position)) return false;
            const [x, y] = piece.position;
            const cell = this.board.get_cell(x, y);
            return !!(cell && cell.includes(piece));
        }

        _getPiperSuppressedTeams() {
            const suppressed = new Set();
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    for (const piece of cell) {
                        if (!piece || piece.name !== '魔笛手' || piece.state !== 'alive') continue;
                        if (r <= 1) suppressed.add('black');
                        if (r >= 10) suppressed.add('white');
                    }
                }
            }
            return suppressed;
        }

        _isTeamSuppressedByPiper(team) {
            return this._getPiperSuppressedTeams().has(team);
        }

        _enforcePiperTerritorySuppression() {
            const suppressedTeams = this._getPiperSuppressedTeams();
            if (!suppressedTeams.size) return [];

            const revertCount = { black: 0, white: 0 };
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    for (const piece of cell) {
                        if (!piece || piece.state !== 'alive') continue;
                        if (!suppressedTeams.has(piece.team)) continue;
                        if (!(piece.name === '孩子' || piece.name === '红叶儿' || piece.is_red_child || piece.learned_red_song)) continue;

                        const hadRedSong = !!(piece.name === '红叶儿' || piece.is_red_child || piece.learned_red_song);
                        piece.is_red_child = false;
                        piece.learned_red_song = false;
                        piece.name = '孩子';
                        piece.symbol = '子';
                        piece.can_jump_grave = true;
                        if (hadRedSong) {
                            revertCount[piece.team] += 1;
                        }
                    }
                }
            }

            const messages = [];
            for (const team of ['black', 'white']) {
                if (suppressedTeams.has(team) && revertCount[team] > 0) {
                    messages.push(`魔笛手压制${team === 'black' ? '黑方' : '白方'}阵地红歌：${revertCount[team]}枚孩子恢复为普通状态`);
                }
            }
            return messages;
        }

        _hasDestinyOverrideForRoll(piece) {
            return !!(piece
                && piece.destiny_dice_active);
        }

        _consumeDestinyOverride(piece) {
            if (!piece) return;
            piece.destiny_dice_active = false;
            piece.destiny_dice_success = true;
            piece.destiny_dice_owner_turn = null;
        }

        _runWithDestinyOverride(piece, runFn, extractDiceFn = null) {
            const hasOverride = this._hasDestinyOverrideForRoll(piece);
            let result;
            if (hasOverride) {
                const forcedValue = piece.destiny_dice_success ? 99 : 1;
                const forcedRolls = [Math.floor(forcedValue / 10), forcedValue % 10];
                result = DiceEngine.withForcedRolls(forcedRolls, runFn);
            } else {
                result = runFn();
            }
            if (!hasOverride) {
                return result;
            }
            const dice = typeof extractDiceFn === 'function' ? extractDiceFn(result) : null;
            if (dice !== null && dice !== undefined) {
                this._consumeDestinyOverride(piece);
            }
            return result;
        }

        reconcileGreenWifeCell(x, y) {
            const cell = this.board.get_cell(x, y);
            if (!cell || cell.length === 0) return;
            const wife = cell.find(p => p && p.is_green_wife);
            if (!wife) return;

            let host = wife.host_citizen;
            if (!host || host.state !== 'alive' || host.name !== '市民') {
                const candidate = cell.find(p => p && p.name === '市民' && p.state === 'alive' && p.team === wife.team);
                host = candidate || null;
                wife.host_citizen = host;
            }

            if (!host) {
                wife.release_possession(this.board);
                return;
            }

            if (!this._isPieceOnBoard(host)) {
                this.board.add_piece(host, x, y);
            } else if (host.position[0] !== x || host.position[1] !== y) {
                this.board.move_specific_piece(host, x, y);
            }

            if (!this._isPieceOnBoard(wife)) {
                this.board.add_piece(wife, x, y);
            }

            const nextCell = this.board.get_cell(x, y);
            if (!nextCell) return;
            const middle = nextCell.filter(p => p !== host && p !== wife);
            nextCell.length = 0;
            nextCell.push(host);
            for (const p of middle) nextCell.push(p);
            nextCell.push(wife);

            host.position = [x, y];
            wife.position = [x, y];
            wife.is_possessed = true;
            wife.is_green_wife = true;
            wife.name = '绿叶妻';
            wife.symbol = '绿';
            wife.host_citizen = host;
        }

        reconcileGreenWifeComposite() {
            const cells = [];
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    if (cell && cell.some(p => p && p.is_green_wife)) {
                        cells.push([r, c]);
                    }
                }
            }
            for (const [r, c] of cells) {
                this.reconcileGreenWifeCell(r, c);
            }
        }

        _hasActiveGreenWife(team) {
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    for (const piece of cell) {
                        if (piece && piece.team === team && piece.state === 'alive' && piece.is_green_wife) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        _hasLearnedRedSongChild(team) {
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    for (const piece of cell) {
                        if (!piece || piece.team !== team || piece.state !== 'alive') continue;
                        if ((piece.name === '孩子' || piece.name === '红叶儿') && (piece.learned_red_song || piece.is_red_child)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        _syncTeamProgressFlags() {
            const teamReady = {
                black: { wife_ready: false, child_ready: false },
                white: { wife_ready: false, child_ready: false }
            };
            teamReady.black.wife_ready = this._hasActiveGreenWife('black');
            teamReady.black.child_ready = this._hasLearnedRedSongChild('black');
            teamReady.white.wife_ready = this._hasActiveGreenWife('white');
            teamReady.white.child_ready = this._hasLearnedRedSongChild('white');
            this.team_progress = teamReady;
        }

        _canYeTransform(ye) {
            if (!ye || ye.name !== '叶某' || ye.is_nightmare) return false;
            return ye.check_transformation_conditions(this.board);
        }

        _tryAutoTransformYe(ye) {
            if (!this._canYeTransform(ye)) return null;
            const transformResult = NightmareManager.transform_ye_to_nightmare(this.board, ye);
            if (transformResult[0]) {
                const message = transformResult[2];
                const rollMeta = transformResult[3] && typeof transformResult[3] === 'object'
                    ? Object.assign({}, transformResult[3])
                    : null;
                if (rollMeta) {
                    const firstTransform = !this.nightmare_first_transform_done;
                    if (firstTransform) {
                        this.nightmare_first_transform_done = true;
                    }
                    rollMeta.first_transform = firstTransform;
                    rollMeta.trigger_glitch = !!firstTransform || rollMeta.state === 'night';
                }
                return {
                    message,
                    nightmare_roll: rollMeta
                };
            }
            return null;
        }

        _tryAutoTransformYeAll(team = null) {
            const candidates = [];
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    for (const piece of cell) {
                        if (!piece || piece.name !== '叶某' || piece.is_nightmare || piece.state !== 'alive') continue;
                        if (team && piece.team !== team) continue;
                        candidates.push(piece);
                    }
                }
            }
            const messages = [];
            const nightmare_rolls = [];
            for (const ye of candidates) {
                const transformed = this._tryAutoTransformYe(ye);
                if (transformed && transformed.message) {
                    messages.push(transformed.message);
                }
                if (transformed && transformed.nightmare_roll) {
                    nightmare_rolls.push(transformed.nightmare_roll);
                }
            }
            return { messages, nightmare_rolls };
        }

        _refreshVFormationBindings() {
            const shouldBreakByPossession = (citizen) => {
                const [x, y] = citizen.position;
                const cell = this.board.get_cell(x, y);
                return cell.some(p => p && p.is_green_wife && p.host_citizen === citizen);
            };
            const tracked = {};
            for (const [fid, memberIds] of Object.entries(this.v_formations || {})) {
                const members = memberIds
                    .map(uid => this._findPieceByUid(uid))
                    .filter(p => p && p.name === '市民');
                const broken = members.length === 0
                    || members.some(p => p.state !== 'alive' || shouldBreakByPossession(p));
                if (broken) {
                    for (const p of members) {
                        delete p.v_formation_id;
                    }
                    continue;
                }
                tracked[fid] = members.map(p => ensureUid(p));
                for (const p of members) {
                    p.v_formation_id = Number(fid);
                }
            }
            this.v_formations = tracked;

            const assignTeam = (team) => {
                let [hasV, formation] = CitizenManager.check_v_formation(this.board, team);
                while (hasV && formation && formation.length) {
                    const unbound = formation.filter(p => !p.v_formation_id);
                    if (!unbound.length) break;
                    const id = this.next_v_formation_id++;
                    for (const member of formation) {
                        member.v_formation_id = id;
                    }
                    this.v_formations[id] = formation.map(p => ensureUid(p));
                    [hasV, formation] = CitizenManager.check_v_formation(this.board, team);
                }
            };
            assignTeam('black');
            assignTeam('white');
        }

        _getFormationMembersById(formationId) {
            const ids = (this.v_formations && this.v_formations[formationId]) || [];
            return ids
                .map(uid => this._findPieceByUid(uid))
                .filter(piece => piece && piece.name === '市民' && piece.state === 'alive');
        }

        evaluateBoard(team = this.current_turn) {
            if (!team) return 0;
            const opponent = team === 'black' ? 'white' : 'black';
            const board = this.board;

            const findDeathGod = () => {
                for (let i = 0; i < board.size; i++) {
                    for (let j = 0; j < board.size; j++) {
                        const cell = board.get_cell(i, j);
                        for (const piece of cell) {
                            if (piece.name === '死神') {
                                return [i, j];
                            }
                        }
                    }
                }
                return null;
            };

            const deathGodPos = findDeathGod();
            const inDeathGodZone = (piece) => {
                if (!deathGodPos) return false;
                const [dx, dy] = [Math.abs(piece.position[0] - deathGodPos[0]), Math.abs(piece.position[1] - deathGodPos[1])];
                return dx <= 1 && dy <= 1;
            };

            const scoreTeam = (side) => {
                let score = 0;

                for (let i = 0; i < board.size; i++) {
                    for (let j = 0; j < board.size; j++) {
                        const cell = board.get_cell(i, j);
                        for (const piece of cell) {
                            if (!piece || piece.state !== 'alive') continue;
                            if (piece.team !== side) continue;

                            if (piece.name === '孩子' || piece.name === '红叶儿' || piece.is_red_child) {
                                score += 2000;
                                if (piece.learned_red_song || piece.is_red_child || piece.name === '红叶儿') {
                                    score += 200;
                                }
                            } else if (piece.name === '夜魔' || piece.is_nightmare) {
                                score += 800;
                            } else if (piece.name === '警察') {
                                score += 400;
                            } else if (piece.name === '市民') {
                                score += 100;
                                const progress = side === 'black'
                                    ? (piece.position[0] - piece.initial_position[0])
                                    : (piece.initial_position[0] - piece.position[0]);
                                score += progress * 15;
                            }

                            if (inDeathGodZone(piece)) {
                                score -= 50;
                            }
                        }
                    }
                }

                const [hasV] = CitizenManager.check_v_formation(board, side);
                if (hasV) {
                    score += 50;
                }

                return score;
            };

            return scoreTeam(team) - scoreTeam(opponent);
        }

        applyMove(fromPos, toPos, piece_id = null) {
            if (this.game_over) return { success: false, message: '游戏已结束' };
            if (!fromPos || !toPos) return { success: false, message: '缺少移动位置' };

            const [fx, fy] = fromPos;
            const cell = this.board.get_cell(fx, fy);
            if (!cell || cell.length === 0) return { success: false, message: '起点没有棋子' };

            const piece = this._getPieceFromCell(cell, piece_id);
            if (!piece) return { success: false, message: '起点没有棋子' };

            if (piece.name === '市民' && this._findAttachedGreenWife(piece)) {
                return { success: false, message: '该市民处于绿叶妻附身状态，只能操控绿叶妻移动' };
            }

            if (piece.is_arrested) {
                return { success: false, message: `${piece.name}被拘留中，无法移动` };
            }
            if (piece.is_saved || piece.state === 'monk_forever') {
                return { success: false, message: `${piece.name}正在修行中，无法移动` };
            }
            if (CitizenManager.is_piece_frozen(piece)) {
                return { success: false, message: `${piece.name}被市民包围，无法动弹` };
            }
            if (!this.can_control_piece(piece)) {
                return { success: false, message: `无法操控${piece.name}` };
            }
            if (!this.can_move_piece()) {
                return { success: false, message: '本回合已行动' };
            }

            this.reconcileGreenWifeComposite();
            this._refreshVFormationBindings();
            if (piece.name === '市民' && piece.v_formation_id) {
                const formation = this._getFormationMembersById(piece.v_formation_id);
                if (!formation.length) {
                    return { success: false, message: 'V阵型状态失效，请重试' };
                }
                const moveRes = CitizenManager.move_v_formation(this.board, formation, piece.team);
                const success = moveRes[0];
                const msg = moveRes[1];
                if (!success) return { success: false, message: msg };

                this.mark_move_action();
                refreshCitizenUpgradeFlags(this.board);
                const piperSuppressionMsgs = this._enforcePiperTerritorySuppression();
                this._syncTeamProgressFlags();
                this._refreshVFormationBindings();
                CitizenManager.update_frozen_status(this.board);
                for (const piperMsg of piperSuppressionMsgs) {
                    this.log_event(piperMsg);
                }

                this.log_event(msg);
                return { success: true, message: msg, formation_move: true, formation_size: formation.length };
            }

            let moved = false;
            let captureMsg = null;
            let randomMoveMeta = null;

            if (piece.is_green_wife) {
                const directionResult = SquareDancerManager.resolveDirectionDiceWithRerollTrace();
                const directionDice = directionResult.direction_dice;
                const directionRolls = Array.isArray(directionResult.rolls) ? directionResult.rolls.slice() : [directionDice];
                if (directionDice === 0) {
                    const host = piece.host_citizen;
                    const hostInit = host && Array.isArray(host.initial_position)
                        ? host.initial_position.slice()
                        : (host && Array.isArray(host.position) ? host.position.slice() : null);
                    piece.release_possession(this.board);
                    let hostResolvedPos = null;
                    if (host && host.state === 'alive' && hostInit && this.board.is_valid_position(hostInit[0], hostInit[1])) {
                        if (!this._isPieceOnBoard(host)) {
                            this.board.add_piece(host, hostInit[0], hostInit[1]);
                        } else {
                            this.board.move_specific_piece(host, hostInit[0], hostInit[1]);
                        }
                        hostResolvedPos = host.position.slice();
                    } else if (host && Array.isArray(host.position)) {
                        hostResolvedPos = host.position.slice();
                    }
                    moved = true;
                    captureMsg = '绿叶妻方向骰为0：解除附身并返回初始位置';
                    randomMoveMeta = {
                        random_move: true,
                        direction_dice: directionDice,
                        steps_dice: null,
                        direction_rolls: directionRolls,
                        resolved_to: {
                            wife: Array.isArray(piece.position) ? piece.position.slice() : null,
                            host: hostResolvedPos
                        },
                        released_possession: true
                    };
                } else {
                    const direction = SquareDancerManager.DIRECTIONS[directionDice];
                    if (!direction || direction === 'reroll') {
                        return { success: false, message: '绿叶妻方向判定异常' };
                    }
                    const stepsDice = DiceEngine.roll_single();
                    const host = piece.host_citizen;
                    if (!host || host.state !== 'alive') {
                        return { success: false, message: '绿叶妻附身状态异常，请重试' };
                    }

                    const [dx, dy] = direction;
                    const [sx, sy] = piece.position;
                    let final = [sx, sy];
                    for (let step = 1; step <= stepsDice; step += 1) {
                        const nx = sx + dx * step;
                        const ny = sy + dy * step;
                        if (!this.board.is_valid_position(nx, ny)) break;
                        // 绿叶妻移动无视障碍物（棋子/墓碑），只受棋盘边界限制。
                        final = [nx, ny];
                    }

                    if (final[0] !== sx || final[1] !== sy) {
                        this.board.move_specific_piece(host, final[0], final[1]);
                        this.board.move_specific_piece(piece, final[0], final[1]);
                    }
                    this.reconcileGreenWifeCell(final[0], final[1]);
                    moved = true;
                    const movedText = (final[0] !== sx || final[1] !== sy)
                        ? `停在${fmtPos(final[0], final[1])}`
                        : '前方超出棋盘边界，原地不动';
                    captureMsg = `绿叶妻随机移动：方向骰${directionDice}，步数骰${stepsDice}，${movedText}`;
                    randomMoveMeta = {
                        random_move: true,
                        direction_dice: directionDice,
                        steps_dice: stepsDice,
                        direction_rolls: directionRolls,
                        resolved_to: final,
                        released_possession: false
                    };
                }
            } else {
                const validMoves = piece.get_valid_moves(this.board);
                if (!validMoves.some(pos => pos[0] === toPos[0] && pos[1] === toPos[1])) {
                    return { success: false, message: '该棋子不能这样移动' };
                }

                const [tx, ty] = toPos;
                const targetCell = this.board.get_cell(tx, ty);
                if (targetCell && targetCell.length > 0) {
                    const targetPiece = targetCell[targetCell.length - 1];
                    if (targetPiece.team !== piece.team && canCaptureCell(this.board, piece, tx, ty)) {
                        const captureResult = capture_piece(this.board, piece, tx, ty);
                        moved = captureResult[0];
                        captureMsg = captureResult[1];
                        if (!moved) return { success: false, message: captureMsg };
                    } else {
                        moved = this.board.move_specific_piece(piece, toPos[0], toPos[1]);
                    }
                } else {
                    moved = this.board.move_specific_piece(piece, toPos[0], toPos[1]);
                }
            }

            if (!moved) return { success: false, message: '移动执行失败' };
            if (Object.prototype.hasOwnProperty.call(piece, 'has_moved')) {
                piece.has_moved = true;
            }
            this.reconcileGreenWifeComposite();
            if (piece.name === '警察' && piece.arrested_piece) {
                piece.arrested_piece.position = piece.position.slice();
            }

            this.mark_move_action();

            const formationMessages = [];
            const formationEffects = CitizenManager.check_formation_after_move(this.board, piece);
            for (const effect of formationEffects) {
                const [targetPiece, surroundType, citizens] = effect;
                const effectRes = CitizenManager.apply_surround_effect(this.board, targetPiece, surroundType, citizens);
                if (effectRes[0]) {
                    formationMessages.push(effectRes[1]);
                    this.log_event(effectRes[1]);
                }
            }

            CitizenManager.update_frozen_status(this.board);
            refreshCitizenUpgradeFlags(this.board);
            const piperSuppressionMsgs = this._enforcePiperTerritorySuppression();
            this._syncTeamProgressFlags();
            this._refreshVFormationBindings();
            for (const piperMsg of piperSuppressionMsgs) {
                this.log_event(piperMsg);
                formationMessages.push(piperMsg);
            }

            const transformRes = this._tryAutoTransformYeAll(
                (piece.team === 'black' || piece.team === 'white') ? piece.team : null
            );
            const autoNightmareRolls = Array.isArray(transformRes.nightmare_rolls)
                ? transformRes.nightmare_rolls.slice()
                : [];
            for (const transformMsg of (transformRes.messages || [])) {
                this.log_event(transformMsg);
                formationMessages.push(transformMsg);
            }

            let msg = captureMsg ? captureMsg : `玩家移动: ${piece.name} (${n2a(fromPos[0], fromPos[1])} -> ${n2a(toPos[0], toPos[1])})`;
            if (formationMessages.length) {
                msg += ` | ${formationMessages.join(' | ')}`;
            }
            this.log_event(msg);
            const result = { success: true, message: msg, formation_effects: formationMessages };
            if (autoNightmareRolls.length) {
                result.nightmare_rolls = autoNightmareRolls;
            }
            if (randomMoveMeta) {
                Object.assign(result, randomMoveMeta);
            }
            return result;
        }

        _isGreenWifePathBlocked(x, y, host, wife) {
            if (!this.board.is_valid_position(x, y)) return true;
            const cell = this.board.get_cell(x, y);
            if (!Array.isArray(cell) || cell.length === 0) return false;
            return cell.some(p => p !== host && p !== wife);
        }

        applyMoveSandbox(fromPos, toPos, piece_id = null) {
            if (!fromPos || !toPos) return { success: false, message: '缺少移动位置' };

            const [fx, fy] = fromPos;
            const sourceCell = this.board.get_cell(fx, fy);
            if (!sourceCell || sourceCell.length === 0) return { success: false, message: '起点没有棋子' };

            const piece = this._getPieceFromCell(sourceCell, piece_id);
            if (!piece) return { success: false, message: '起点没有棋子' };
            if (piece.state !== 'alive') return { success: false, message: '仅可操作棋盘上的存活棋子' };

            const result = this.applyMove(fromPos, toPos, piece_id);
            return result;
        }

        sandbox_relocate(fromPos, toPos, piece_id = null) {
            if (!this.sandbox_mode) {
                return { success: false, message: '沙盒模式未开启' };
            }
            if (!fromPos || !toPos) {
                return { success: false, message: '缺少移动位置' };
            }

            const [fx, fy] = fromPos;
            const [tx, ty] = toPos;
            if (!this.board.is_valid_position(fx, fy) || !this.board.is_valid_position(tx, ty)) {
                return { success: false, message: '坐标超出棋盘范围' };
            }
            if (fx === tx && fy === ty) {
                return { success: false, message: '目标位置与起点相同' };
            }

            const sourceCell = this.board.get_cell(fx, fy);
            if (!sourceCell || sourceCell.length === 0) {
                return { success: false, message: '起点没有棋子' };
            }

            const piece = this._getPieceFromCell(sourceCell, piece_id);
            if (!piece) {
                return { success: false, message: '未找到指定棋子' };
            }
            this.reconcileGreenWifeComposite();
            if (piece.name === '市民' && this._findAttachedGreenWife(piece)) {
                return { success: false, message: '该市民处于绿叶妻附身状态，只能操控绿叶妻移动' };
            }
            if (piece.state !== 'alive') {
                return { success: false, message: '仅可摆位棋盘上的存活棋子' };
            }

            const moved = this.board.move_specific_piece(piece, tx, ty);
            if (!moved) {
                return { success: false, message: '摆位执行失败' };
            }

            if (Object.prototype.hasOwnProperty.call(piece, 'has_moved')) {
                piece.has_moved = true;
            }
            this.reconcileGreenWifeComposite();
            if (piece.name === '警察' && piece.arrested_piece) {
                piece.arrested_piece.position = piece.position.slice();
            }

            this.mark_move_action();
            const formationMessages = [];
            const formationEffects = CitizenManager.check_formation_after_move(this.board, piece);
            for (const effect of formationEffects) {
                const [targetPiece, surroundType, citizens] = effect;
                const effectRes = CitizenManager.apply_surround_effect(this.board, targetPiece, surroundType, citizens);
                if (effectRes[0]) {
                    formationMessages.push(effectRes[1]);
                    this.log_event(effectRes[1]);
                }
            }

            CitizenManager.update_frozen_status(this.board);
            refreshCitizenUpgradeFlags(this.board);
            this._syncTeamProgressFlags();
            this._refreshVFormationBindings();
            const transformRes = this._tryAutoTransformYeAll(
                (piece.team === 'black' || piece.team === 'white') ? piece.team : null
            );
            const autoNightmareRolls = Array.isArray(transformRes.nightmare_rolls)
                ? transformRes.nightmare_rolls.slice()
                : [];
            for (const transformMsg of (transformRes.messages || [])) {
                this.log_event(transformMsg);
                formationMessages.push(transformMsg);
            }

            let msg = `【沙盒摆位】${piece.team}方${piece.name} (${n2a(fx, fy)} -> ${n2a(tx, ty)})`;
            if (formationMessages.length) {
                msg += ` | ${formationMessages.join(' | ')}`;
            }
            this.log_event(msg);
            return {
                success: true,
                message: msg,
                formation_effects: formationMessages,
                nightmare_rolls: autoNightmareRolls,
                moved_piece: {
                    name: piece.name,
                    symbol: piece.symbol,
                    team: piece.team,
                    id: ensureUid(piece)
                },
                from_pos: [fx, fy],
                to_pos: [tx, ty]
            };
        }

        sandbox_capture(fromPos, toPos, piece_id = null) {
            if (!this.sandbox_mode) {
                return { success: false, message: '沙盒模式未开启' };
            }
            if (!fromPos || !toPos) {
                return { success: false, message: '缺少吃子位置' };
            }
            const [tx, ty] = toPos;
            if (!this.board.is_valid_position(tx, ty)) {
                return { success: false, message: '目标位置超出棋盘范围' };
            }
            const targetCell = this.board.get_cell(tx, ty);
            if (!targetCell || targetCell.length === 0) {
                return { success: false, message: '目标格没有可吃棋子' };
            }
            const result = this.applyMoveSandbox(fromPos, toPos, piece_id);
            if (!result.success) return result;
            const msg = `【沙盒吃子】${result.message}`;
            this.log_event(msg);
            return Object.assign({}, result, { message: msg });
        }

        log_event(message) {
            this.log_history.push(message);
        }

        start_game_after_initiative(black_first) {
            this.board.setup_initial_position(black_first);
            this.current_turn = black_first ? 'black' : 'white';
            this.turn_count = 1;
            this.death_god_zero_count = 0;
            this.game_over = false;
            this.phase = 'PLAYING';
            this.last_round_tick = 0;
            this.team_swap_used = { black: false, white: false };
            this.team_progress = {
                black: { wife_ready: false, child_ready: false },
                white: { wife_ready: false, child_ready: false }
            };
            this.v_formations = {};
            this.next_v_formation_id = 1;
            this.nightmare_first_transform_done = false;
            this.log_event(`游戏开始！先手方 ${black_first ? '黑方' : '白方'}`);
            return true;
        }

        roll_initiative() {
            let black_roll = 0;
            let white_roll = 0;
            let winner = null;

            while (true) {
                black_roll = DiceEngine.roll_single();
                white_roll = DiceEngine.roll_single();
                if (black_roll > white_roll) {
                    winner = 'black';
                    break;
                } else if (white_roll > black_roll) {
                    winner = 'white';
                    break;
                }
            }

            this.start_game_after_initiative(winner === 'black');
            return [black_roll, white_roll, winner];
        }

        start_game(black_first = true) {
            this.board.setup_initial_position(black_first);
            this.current_turn = black_first ? 'black' : 'white';
            this.turn_count = 1;
            this.death_god_zero_count = 0;
            this.game_over = false;
            this.last_round_tick = 0;
            this.team_swap_used = { black: false, white: false };
            this.team_progress = {
                black: { wife_ready: false, child_ready: false },
                white: { wife_ready: false, child_ready: false }
            };
            this.v_formations = {};
            this.next_v_formation_id = 1;
            this.nightmare_first_transform_done = false;
            this.log_event('游戏开始');
            return true;
        }

        start_turn() {
            const info = {
                turn_count: this.turn_count,
                current_player: this.current_turn,
                death_god_moved: false,
                death_god_message: '',
                game_over: false,
                states_updated: false,
                nightmare_rolls: []
            };

            const roundCount = this.get_round_count();
            this.log_event(`=== 第${roundCount}回合开始(${this.current_turn === 'black' ? '黑方' : '白方'}) ===`);

            this.death_god_zero_count = 0;

            const death_god = DeathGodManager.find_death_god(this.board);
            if (death_god) {
                let reroll_count = 0;
                while (true) {
                    const [dice, direction, is_triple_zero, msg] = DeathGodManager.roll_death_god_direction(
                        this.death_god_zero_count
                    );

                    info.death_god_dice = dice;
                    info.death_god_message = reroll_count === 0
                        ? msg
                        : `${info.death_god_message} -> ${msg}`;

                    if (dice === 9) {
                        reroll_count += 1;
                        info.death_god_reroll = true;
                        if (reroll_count >= 3) {
                            info.death_god_message += ' (达到重摇上限，强制停留)';
                            this.death_god_zero_count += 1;
                            info.death_god_moved = false;
                            break;
                        }
                        continue;
                    }

                    if (is_triple_zero) {
                        this.game_over = true;
                        this.winner = 'draw';
                        this.win_reason = '死神连续三次0，吃掉所有棋子';
                        info.game_over = true;
                        this.log_event(`死神掷出: ${dice} (连续三次0) -> 游戏平局`);
                        return info;
                    } else if (dice === 0) {
                        this.death_god_zero_count += 1;
                        info.death_god_moved = false;
                        this.log_event(`死神掷出: 0 -> 原地停留 (累计0次数: ${this.death_god_zero_count})`);
                        break;
                    } else {
                        this.death_god_zero_count = 0;
                        const [success, eaten, move_msg] = DeathGodManager.move_death_god(
                            this.board,
                            death_god,
                            direction
                        );
                        info.death_god_moved = success;
                        info.death_god_eaten = eaten.map(p => p.name);
                        info.death_god_message += ` - ${move_msg}`;
                        this.log_event(`死神掷出: ${dice} (${msg}) -> ${move_msg}`);
                        const ateChild = Array.isArray(eaten) && eaten.some(p => this._isChildLikePiece(p));
                        if (ateChild) {
                            const winCheck = this.check_win_condition();
                            if (winCheck && winCheck.winner) {
                                this.game_over = true;
                                this.winner = winCheck.winner;
                                this.win_reason = winCheck.win_reason || '死神吞噬孩子，游戏结束';
                                info.game_over = true;
                                info.winner = this.winner;
                                info.win_reason = this.win_reason;
                                info.death_god_message += ` | ${this.win_reason}`;
                                this.log_event(`死神吞噬孩子触发即时结算：${this.win_reason}`);
                                return info;
                            }
                        }
                        break;
                    }
                }
            }

            this.update_states_per_turn();
            const rc = this.get_round_count();
            if (rc > this.last_round_tick) {
                const roundUpdateInfo = this.update_states_per_round();
                this.last_round_tick = rc;
                info.states_updated = true;
                if (roundUpdateInfo && Array.isArray(roundUpdateInfo.nightmare_rolls) && roundUpdateInfo.nightmare_rolls.length) {
                    info.nightmare_rolls.push(...roundUpdateInfo.nightmare_rolls);
                }
            }
            const transformRes = this._tryAutoTransformYeAll();
            for (const msg of (transformRes.messages || [])) {
                this.log_event(msg);
            }
            if (transformRes && Array.isArray(transformRes.nightmare_rolls) && transformRes.nightmare_rolls.length) {
                info.nightmare_rolls.push(...transformRes.nightmare_rolls);
            }
            this.action_taken = null;
            return info;
        }

        end_turn() {
            const info = {
                game_over: false,
                winner: null,
                win_reason: null
            };
            for (let r = 0; r < this.board.size; r += 1) {
                for (let c = 0; c < this.board.size; c += 1) {
                    const cell = this.board.get_cell(r, c);
                    for (const piece of cell) {
                        if (piece && piece.name === '鼹鼠') {
                            piece.pending_tunnel_roll = null;
                            piece.pending_tunnel = null;
                        }
                    }
                }
            }

            const win_check = this.check_win_condition();
            if (win_check.winner) {
                this.game_over = true;
                this.winner = win_check.winner;
                this.win_reason = win_check.win_reason;

                info.game_over = true;
                info.winner = this.winner;
                info.win_reason = this.win_reason;
            } else {
                this.current_turn = this.current_turn === 'black' ? 'white' : 'black';
                this.turn_count += 1;
            }

            return info;
        }

        update_states_per_turn() {
            this.reconcileGreenWifeComposite();
            MonkManager.reconcile_monk_locks(this.board);
            refreshCitizenUpgradeFlags(this.board);
            const piperSuppressionMsgs = this._enforcePiperTerritorySuppression();
            for (const msg of piperSuppressionMsgs) {
                this.log_event(msg);
            }
            this._syncTeamProgressFlags();
            this._refreshVFormationBindings();
        }

        update_states_per_round() {
            const nightmare_rolls = [];
            const cooldowns_to_remove = [];
            for (const key in this.skill_cooldowns) {
                const keyParts = key.split(':');
                const piece_uid = keyParts[0];
                const piece = this._findPieceByUid(piece_uid);
                if (!piece) {
                    cooldowns_to_remove.push(key);
                    continue;
                }
                const remaining = this.skill_cooldowns[key] - 1;
                if (remaining <= 0) {
                    cooldowns_to_remove.push(key);
                } else {
                    this.skill_cooldowns[key] = remaining;
                }
            }
            for (const key of cooldowns_to_remove) {
                delete this.skill_cooldowns[key];
            }

            const states_to_remove = [];
            for (const piece_id in this.state_durations) {
                const states = this.state_durations[piece_id];
                for (const state_name in states) {
                    const remaining = states[state_name] - 1;
                    if (remaining <= 0) {
                        states_to_remove.push([piece_id, state_name]);
                    } else {
                        states[state_name] = remaining;
                    }
                }
            }
            for (const [piece_id, state_name] of states_to_remove) {
                if (this.state_durations[piece_id]) {
                    delete this.state_durations[piece_id][state_name];
                }
            }

            this.reconcileGreenWifeComposite();
            MonkManager.reconcile_monk_locks(this.board);

            const polices = [];
            const nightmares = [];
            for (let i = 0; i < this.board.size; i++) {
                for (let j = 0; j < this.board.size; j++) {
                    const cell = this.board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.is_saved && piece.state !== 'monk_forever') {
                            piece.save_duration -= 1;
                            if (piece.save_duration <= 0) {
                                MonkManager.end_save(this.board, piece);
                                this.log_event(`${piece.name}的庙宇庇护结束，回到原位`);
                            }
                        }
                        if (piece.just_saved) {
                            piece.just_saved_turns = (piece.just_saved_turns || 0) - 1;
                            if (piece.just_saved_turns <= 0) {
                                piece.just_saved = false;
                                piece.just_saved_turns = 0;
                            }
                        }
                        if (piece.name === '警察') {
                            polices.push(piece);
                        }
                        if ((piece.name === '夜魔' || (piece.name === '叶某' && piece.is_nightmare)) && typeof piece.roll_day_night === 'function') {
                            nightmares.push(piece);
                        }
                    }
                }
            }

            for (const police of polices) {
                if (!police.arrested_piece) continue;
                const arrested = police.arrested_piece;
                arrested.position = police.position.slice();
                arrested.arrest_duration = (arrested.arrest_duration || 0) - 1;
                if (arrested.arrest_duration <= 0) {
                    const released = PoliceManager.release_arrested(this.board, police);
                    if (released) {
                        this.log_event(`${arrested.name}拘留结束，已回到初始位置`);
                    }
                }
            }

            for (const nightmare of nightmares) {
                if (!nightmare || nightmare.state !== 'alive') continue;
                if (nightmare.permanent_night) continue;

                let duration = Number.isFinite(nightmare.night_duration)
                    ? nightmare.night_duration
                    : (Number.isFinite(nightmare.nightmare_duration) ? nightmare.nightmare_duration : 0);

                if (duration > 0) {
                    duration -= 1;
                    nightmare.night_duration = duration;
                    nightmare.nightmare_duration = duration;
                }

                if (duration <= 0) {
                    const [isNight, newDuration, dice, detail] = nightmare.roll_day_night();
                    nightmare.night_duration = newDuration;
                    nightmare.nightmare_duration = newDuration;
                    const stateMode = nightmare.permanent_night ? 'perm-night' : (isNight ? 'night' : 'day');
                    const stateLabel = stateMode === 'perm-night' ? '永久黑夜' : (isNight ? `黑夜${newDuration}回合` : `白昼${newDuration}回合`);
                    const normalizedDice = Number(dice);
                    nightmare_rolls.push({
                        source: 'auto',
                        dice: Number.isFinite(normalizedDice) ? normalizedDice : null,
                        tens: Number.isFinite(normalizedDice) ? Math.floor(normalizedDice / 10) : null,
                        ones: Number.isFinite(normalizedDice) ? (normalizedDice % 10) : null,
                        state: stateMode,
                        detail: detail || '',
                        mode_text: stateMode === 'perm-night' ? '永久黑夜' : (stateMode === 'night' ? '黑夜' : '白昼'),
                        first_transform: false,
                        trigger_glitch: stateMode === 'night'
                    });
                    this.log_event(`夜魔自动热爱黑黑判定：${dice === null || dice === undefined ? '--' : dice.toString().padStart(2, '0')} -> ${stateLabel}（${detail}）`);
                }
            }

            refreshCitizenUpgradeFlags(this.board);
            this._syncTeamProgressFlags();
            this._refreshVFormationBindings();
            MonkManager.reconcile_monk_locks(this.board);
            return { nightmare_rolls };
        }

        update_states() {
            // Backward compatible wrapper: full update pass.
            this.update_states_per_turn();
            this.update_states_per_round();
        }

        add_skill_cooldown(piece, skill_name, cooldown_turns = 1) {
            const piece_id = ensureUid(piece);
            // 使用“完整回合”计数，额外 +1 以覆盖下一次己方行动窗口。
            this.skill_cooldowns[`${piece_id}:${skill_name}`] = Math.max(1, cooldown_turns) + 1;
        }

        can_use_skill(piece, skill_name) {
            const piece_id = ensureUid(piece);
            return !(`${piece_id}:${skill_name}` in this.skill_cooldowns);
        }

        get_skill_cooldown_remaining(piece, skill_name) {
            const piece_id = ensureUid(piece);
            const key = `${piece_id}:${skill_name}`;
            if (!(key in this.skill_cooldowns)) return 0;
            return Math.max(0, this.skill_cooldowns[key] - 1);
        }

        get_piece_skill_cooldowns(piece) {
            const piece_id = ensureUid(piece);
            const result = {};
            const prefix = `${piece_id}:`;
            for (const [key, value] of Object.entries(this.skill_cooldowns)) {
                if (!key.startsWith(prefix)) continue;
                const skillName = key.slice(prefix.length);
                result[skillName] = Math.max(0, value - 1);
            }
            return result;
        }

        add_state_duration(piece, state_name, duration_turns) {
            const piece_id = ensureUid(piece);
            if (!this.state_durations[piece_id]) {
                this.state_durations[piece_id] = {};
            }
            this.state_durations[piece_id][state_name] = duration_turns;
        }

        can_control_piece(piece) {
            if (piece.name === '死神') {
                return false;
            }
            if (piece.name === '市民' && this._findAttachedGreenWife(piece)) {
                return false;
            }
            if ((piece.name === '夜魔' || piece.is_nightmare) && typeof piece.can_move_now === 'function' && !piece.can_move_now()) {
                return false;
            }
            return piece.team === this.current_turn || piece.team === 'neutral';
        }

        can_move_piece() {
            return this.action_taken === null;
        }

        can_use_skill_action() {
            return this.action_taken === null;
        }

        mark_move_action() {
            this.action_taken = 'move';
        }

        mark_skill_action() {
            this.action_taken = 'skill';
        }

        get_action_status() {
            if (this.action_taken === null) {
                return '尚未行动（可移动或使用技能）';
            }
            if (this.action_taken === 'move') {
                return '已移动（本回合不能再使用技能）';
            }
            return '已使用技能（本回合不能再移动）';
        }

        _collectAliveCitizens() {
            const citizens = [];
            for (let i = 0; i < this.board.size; i++) {
                for (let j = 0; j < this.board.size; j++) {
                    const cell = this.board.get_cell(i, j);
                    for (const piece of cell) {
                        if (!piece || piece.state !== 'alive') continue;
                        if (piece.name === '市民') citizens.push(piece);
                    }
                }
            }
            return citizens;
        }

        _isChildLikePiece(piece) {
            if (!piece) return false;
            return piece.name === '孩子'
                || piece.name === '红叶儿'
                || piece.name === 'Red Child'
                || !!piece.is_red_child;
        }

        _isOnlyRemainingCitizenCapturedByPermanentVortex(target_piece) {
            if (!target_piece || target_piece.state !== 'alive') return false;
            const citizens = this._collectAliveCitizens();
            if (citizens.length !== 1) return false;
            const lastCitizen = citizens[0];
            if (target_piece === lastCitizen) return true;
            if (target_piece.is_green_wife && target_piece.host_citizen === lastCitizen) return true;
            if (Array.isArray(target_piece.position)) {
                const [x, y] = target_piece.position;
                if (this.board.is_valid_position(x, y)) {
                    const cell = this.board.get_cell(x, y) || [];
                    if (cell.includes(lastCitizen)) return true;
                }
            }
            return false;
        }

        check_win_condition() {
            let black_citizens = 0;
            let white_citizens = 0;
            let black_child_alive = false;
            let white_child_alive = false;

            for (let i = 0; i < this.board.size; i++) {
                for (let j = 0; j < this.board.size; j++) {
                    const cell = this.board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.state !== 'alive') continue;
                        if (piece.name === '市民') {
                            if (piece.team === 'black') black_citizens += 1;
                            if (piece.team === 'white') white_citizens += 1;
                        } else if (piece.name === '孩子' || piece.name === '红叶儿' || piece.name === 'Red Child') {
                            if (piece.team === 'black') black_child_alive = true;
                            if (piece.team === 'white') white_child_alive = true;
                        }
                    }
                }
            }

            const result = {
                black_citizens,
                white_citizens,
                black_child_alive,
                white_child_alive,
                winner: null,
                win_reason: null
            };

            if (black_citizens === 0 && white_citizens === 0) {
                result.winner = 'draw';
                result.win_reason = '双方市民全灭，平局';
                return result;
            }

            if (!black_child_alive && !white_child_alive) {
                result.winner = 'draw';
                result.win_reason = '双方孩子都被将死，平局';
                return result;
            }

            if (black_citizens === 0 && white_citizens > 0) {
                result.winner = 'white';
                result.win_reason = '黑方市民全灭';
            } else if (white_citizens === 0 && black_citizens > 0) {
                result.winner = 'black';
                result.win_reason = '白方市民全灭';
            } else if (!black_child_alive && white_child_alive) {
                result.winner = 'white';
                result.win_reason = '黑方孩子被将死';
            } else if (!white_child_alive && black_child_alive) {
                result.winner = 'black';
                result.win_reason = '白方孩子被将死';
            }

            return result;
        }

        surrender(team) {
            if (this.game_over) {
                return { success: false, message: '游戏已结束' };
            }

            this.game_over = true;
            this.winner = team === 'black' ? 'white' : 'black';
            this.win_reason = `${team}方投降`;
            this.log_event(`${team}方投降，游戏结束。胜者：${this.winner}`);

            return {
                success: true,
                winner: this.winner,
                win_reason: this.win_reason,
                message: `${team}方认输`
            };
        }

        get_game_state() {
            return {
                turn_count: this.turn_count,
                round_count: this.get_round_count(),
                current_turn: this.current_turn,
                phase: this.phase,
                death_god_zero_count: this.death_god_zero_count,
                game_over: this.game_over,
                winner: this.winner,
                win_reason: this.win_reason,
                sandbox_mode: !!this.sandbox_mode,
                active_cooldowns: Object.keys(this.skill_cooldowns).length,
                active_durations: Object.values(this.state_durations).reduce((sum, v) => sum + Object.keys(v).length, 0)
            };
        }

        use_skill(piece, target_pos = null) {
            if (this.game_over) {
                return { success: false, message: '游戏已结束' };
            }
            if (!piece) {
                return { success: false, message: '缺少棋子' };
            }
            if (!this.can_control_piece(piece)) {
                return { success: false, message: `无法操控${piece.name}` };
            }
            const requestedSkillType = (Array.isArray(target_pos) && typeof target_pos[0] === 'string')
                ? target_pos[0]
                : null;
            const allowTunnelPathFollowup = piece.name === '鼹鼠'
                && requestedSkillType === 'tunnel_path'
                && !!piece.pending_tunnel_roll;
            if (!this.can_use_skill_action() && !allowTunnelPathFollowup) {
                return { success: false, message: '本回合已行动' };
            }
            if (piece.is_arrested) {
                return { success: false, message: `${piece.name}被拘留中，无法使用技能` };
            }
            if (piece.is_saved || piece.state === 'monk_forever') {
                return { success: false, message: `${piece.name}正在修行中，无法使用技能` };
            }
            this.reconcileGreenWifeComposite();
            MonkManager.reconcile_monk_locks(this.board);

            let deathGodTargetPos = null;
            if (Array.isArray(target_pos)) {
                if (Number.isInteger(target_pos[0]) && Number.isInteger(target_pos[1])) {
                    deathGodTargetPos = [target_pos[0], target_pos[1]];
                } else if (
                    typeof target_pos[0] === 'string'
                    && Number.isInteger(target_pos[1])
                    && Number.isInteger(target_pos[2])
                    && ['crush', 'destroy', 'tunnel_prepare', 'tunnel_path', 'tunnel', 'tunnel_commit', 'destiny_success', 'destiny_fail'].includes(target_pos[0])
                ) {
                    deathGodTargetPos = [target_pos[1], target_pos[2]];
                }
            }
            if (deathGodTargetPos) {
                const targetCell = this.board.get_cell(deathGodTargetPos[0], deathGodTargetPos[1]);
                const hasDeathGod = !!(targetCell && targetCell.some(p => p && p.name === '死神'));
                if (hasDeathGod) {
                    return { success: false, message: '技能不能以死神为目标' };
                }
            }

            let success = false;
            let dice = 0;
            let msg = '';
            let state_changed = false;
            let direction_dice_result;
            let skill_key = null;
            let require_tunnel_commit = false;
            let mark_skill_action = true;
            let result_extra = {};
            let immediateGameOver = null;

            if (piece.name === '孩子') {
                skill_key = 'learn';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (piece.is_red_child) {
                    return { success: false, message: '已经是红叶儿了' };
                }
                [success, dice, msg] = this._runWithDestinyOverride(
                    piece,
                    () => piece.learn_red_song(this.board),
                    res => Array.isArray(res) ? res[1] : null
                );
                if (success) state_changed = true;
            } else if (piece.name === '妻子') {
                skill_key = 'possess';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (!target_pos) {
                    return { success: false, message: '请选择一个己方市民作为附身目标' };
                }
                const [tx, ty] = target_pos;
                [success, dice, msg] = this._runWithDestinyOverride(
                    piece,
                    () => piece.possess_citizen(this.board, tx, ty),
                    res => Array.isArray(res) ? res[1] : null
                );
                if (success) state_changed = true;
            } else if (piece.name === '叶某') {
                return { success: false, message: '叶某变身为被动自动触发，无需主动释放技能' };
            } else if (piece.name === '夜魔') {
                let skill_type = 'crush';
                let tx = null;
                let ty = null;

                if (target_pos && typeof target_pos[0] === 'string') {
                    skill_type = target_pos[0];
                    tx = target_pos[1];
                    ty = target_pos[2];
                } else if (target_pos) {
                    tx = target_pos[0];
                    ty = target_pos[1];
                }
                if (skill_type === 'day_night' || !target_pos) {
                    return { success: false, message: '热爱黑黑改为自动判定（在死神掷骰后触发），请使用热爱露露' };
                }
                if (typeof piece.can_move_now === 'function' && !piece.can_move_now()) {
                    return { success: false, message: '当前为白昼，夜魔不可操作' };
                }
                skill_key = 'crush';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }

                const res = NightmareManager.execute_crush_move(this.board, piece, tx, ty);
                success = res[0];
                msg = res[2];
                dice = null;
                if (success) state_changed = true;
            } else if (piece.name === '警察') {
                skill_key = 'arrest';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (!target_pos) {
                    return { success: false, message: '请选择抓捕目标（魔笛手/夜魔）' };
                }
                const cell = this.board.get_cell(target_pos[0], target_pos[1]);
                if (!cell || cell.length === 0) {
                    return { success: false, message: '目标位置无效' };
                }
                const arrestTargets = typeof piece.get_arrest_targets === 'function'
                    ? piece.get_arrest_targets(this.board)
                    : [];
                if (!arrestTargets.some(pos => pos[0] === target_pos[0] && pos[1] === target_pos[1])) {
                    return { success: false, message: '抓捕目标不在警察技能范围内' };
                }
                const target_piece = cell[cell.length - 1];
                [success, dice, msg] = this._runWithDestinyOverride(
                    piece,
                    () => PoliceManager.arrest(this.board, piece, target_piece),
                    res => Array.isArray(res) ? res[1] : null
                );
                if (success) state_changed = true;
            } else if (piece.name === '医生') {
                skill_key = 'resurrect';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (!target_pos || !Number.isInteger(target_pos[0]) || !Number.isInteger(target_pos[1])) {
                    return { success: false, message: '请选择一个墓碑进行复活' };
                }
                [success, dice, msg] = this._runWithDestinyOverride(
                    piece,
                    () => SkillManager.doctor_resurrect(this.board, piece, target_pos[0], target_pos[1]),
                    res => Array.isArray(res) ? res[1] : null
                );
                if (success) state_changed = true;
            } else if (piece.name === '老师') {
                return { success: false, message: '老师技能为被动效果，无需主动释放' };
            } else if (piece.name === '官员') {
                if (!target_pos) {
                    return { success: false, message: '请选择目标：己方律师(互换)或空位(召唤)' };
                }
                const cell = this.board.get_cell(target_pos[0], target_pos[1]);
                if (cell && cell.length > 0 && cell[cell.length - 1].name === '律师' && cell[cell.length - 1].team === piece.team) {
                    skill_key = 'swap';
                    if ((this.team_swap_used[piece.team] || false) === true) {
                        return { success: false, message: '本局同阵营的官员/律师已使用过易位' };
                    }
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    [success, msg] = OfficerSkillManager.swap_with_piece(this.board, piece, cell[cell.length - 1]);
                    dice = null;
                    if (success) {
                        state_changed = true;
                        this.team_swap_used[piece.team] = true;
                    }
                } else {
                    skill_key = 'summon';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    [success, dice, msg] = this._runWithDestinyOverride(
                        piece,
                        () => OfficerSkillManager.summon_ghost(this.board, piece, target_pos[0], target_pos[1]),
                        res => Array.isArray(res) ? res[1] : null
                    );
                    if (success) state_changed = true;
                }
            } else if (piece.name === '律师') {
                skill_key = 'swap';
                if ((this.team_swap_used[piece.team] || false) === true) {
                    return { success: false, message: '本局同阵营的官员/律师已使用过易位' };
                }
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (!target_pos) {
                    return { success: false, message: '请选择己方官员进行易位' };
                }
                const cell = this.board.get_cell(target_pos[0], target_pos[1]);
                if (!cell || cell.length === 0) {
                    return { success: false, message: '目标位置无效' };
                }
                const target_piece = cell[cell.length - 1];
                if (target_piece.name !== '官员' || target_piece.team !== piece.team || target_piece.state !== 'alive') {
                    return { success: false, message: '热爱框框只能与己方官员易位' };
                }
                [success, msg] = OfficerSkillManager.swap_with_piece(this.board, piece, target_piece);
                dice = null;
                if (success) {
                    state_changed = true;
                    this.team_swap_used[piece.team] = true;
                }
            } else if (piece.name === '僧侣') {
                skill_key = 'save';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (!target_pos) {
                    return { success: false, message: '请选择一个棋子进行存档' };
                }
                const cell = this.board.get_cell(target_pos[0], target_pos[1]);
                if (!cell || cell.length === 0) {
                    return { success: false, message: '目标无效' };
                }
                const target_piece = cell[cell.length - 1];
                [success, dice, msg] = MonkManager.save_piece(this.board, piece, target_piece);
                if (success) state_changed = true;
            } else if (piece.name === '广场舞大妈') {
                skill_key = 'vortex';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (!target_pos) {
                    return { success: false, message: '请选择一个目标棋子吸入旋涡' };
                }
                const cell = this.board.get_cell(target_pos[0], target_pos[1]);
                if (!cell || cell.length === 0) {
                    return { success: false, message: '目标无效' };
                }
                const target_piece = cell[cell.length - 1];
                [success, dice, msg, direction_dice_result] = this._runWithDestinyOverride(
                    piece,
                    () => SquareDancerManager.vortex_pull(this.board, piece, target_piece),
                    res => Array.isArray(res) ? res[1] : null
                );
                if (success) state_changed = true;
                if (success && dice === 0 && this._isOnlyRemainingCitizenCapturedByPermanentVortex(target_piece)) {
                    immediateGameOver = {
                        winner: 'draw',
                        win_reason: '广场舞大妈永久旋涡带走场上最后一名市民，游戏结束'
                    };
                    msg = `${msg} | ${immediateGameOver.win_reason}`;
                }
            } else if (piece.name === '鼹鼠') {
                if (!target_pos) {
                    return { success: false, message: '请选择一个目标' };
                }
                const skillType = (typeof target_pos[0] === 'string') ? target_pos[0] : null;

                if (skillType === 'tunnel_roll') {
                    skill_key = 'tunnel';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    piece.pending_tunnel = null;
                    piece.pending_tunnel_roll = null;
                    dice = this._runWithDestinyOverride(
                        piece,
                        () => DiceEngine.roll_double(),
                        result => result
                    );
                    if (dice === 0) {
                        const destroyed = MoleManager.destroy_all_graves(this.board);
                        success = true;
                        state_changed = true;
                        msg = `爆破鼹鼠出现！破坏了场上所有${destroyed}座墓`;
                    } else if (dice >= 50) {
                        success = true;
                        state_changed = true;
                        require_tunnel_commit = true;
                        msg = '召唤鼹鼠成功，请选择要传送的棋子与地道路径';
                        piece.pending_tunnel_roll = {
                            turn: this.turn_count,
                            current_turn: this.current_turn,
                            mole_uid: ensureUid(piece)
                        };
                        result_extra.need_tunnel_endpoint = true;
                        result_extra.mole_pos = piece.position.slice();
                    } else {
                        success = false;
                        msg = `召唤鼹鼠失败（骰子${dice.toString().padStart(2, '0')}）`;
                    }
                } else if (skillType === 'tunnel_prepare') {
                    skill_key = 'tunnel';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    const target_r = target_pos[1];
                    const target_c = target_pos[2];
                    const target_cell = this.board.get_cell(target_r, target_c);
                    if (!target_cell || target_cell.length === 0) {
                        return { success: false, message: '目标位置没有棋子' };
                    }
                    const target_piece = target_cell[target_cell.length - 1];
                    const summon_result = this._runWithDestinyOverride(
                        piece,
                        () => MoleManager.summon_mole(this.board, target_piece),
                        res => Array.isArray(res) ? res[1] : null
                    );
                    dice = summon_result[1];
                    if (!summon_result[0]) {
                        msg = summon_result[3] || '召唤鼹鼠失败';
                        success = false;
                        piece.pending_tunnel = null;
                    } else if (dice === 0) {
                        msg = summon_result[3];
                        success = true;
                        state_changed = true;
                        piece.pending_tunnel = null;
                    } else {
                        success = true;
                        state_changed = true;
                        mark_skill_action = false;
                        require_tunnel_commit = true;
                        msg = `${summon_result[3]}，请选择地道终点`;
                        piece.pending_tunnel = {
                            target_uid: ensureUid(target_piece),
                            target_pos: [target_r, target_c],
                            mole_pos: piece.position.slice()
                        };
                        result_extra.need_tunnel_endpoint = true;
                        result_extra.mole_pos = piece.position.slice();
                        result_extra.tunnel_target_pos = [target_r, target_c];
                    }
                } else if (skillType === 'tunnel_path') {
                    skill_key = 'tunnel';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    const pendingRoll = piece.pending_tunnel_roll || null;
                    const target_r = target_pos[1];
                    const target_c = target_pos[2];
                    const start_r = target_pos[3];
                    const start_c = target_pos[4];
                    const end_r = target_pos[5];
                    const end_c = target_pos[6];

                    if (![target_r, target_c, start_r, start_c, end_r, end_c].every(v => Number.isInteger(v))) {
                        return { success: false, message: '地道参数不完整' };
                    }
                    const target_cell = this.board.get_cell(target_r, target_c);
                    if (!target_cell || target_cell.length === 0) {
                        return { success: false, message: '目标位置没有棋子' };
                    }
                    const target_piece = target_cell[target_cell.length - 1];
                    if (target_piece === piece) {
                        return { success: false, message: '不能传送鼹鼠自身' };
                    }
                    if (target_piece.state !== 'alive') {
                        return { success: false, message: '只能传送存活棋子' };
                    }

                    const tunnelValidate = MoleManager.validate_tunnel_path_v2(this.board, target_piece, start_r, start_c, end_r, end_c);
                    if (!tunnelValidate[0]) {
                        return { success: false, message: tunnelValidate[1] };
                    }

                    if (pendingRoll) {
                        const tunnelRes = MoleManager.dig_tunnel_v2(this.board, piece, target_piece, start_r, start_c, end_r, end_c);
                        success = tunnelRes[0];
                        msg = tunnelRes[1];
                        if (success) {
                            state_changed = true;
                            piece.pending_tunnel_roll = null;
                            result_extra.tunnel_start_pos = [start_r, start_c];
                            result_extra.tunnel_end_pos = [end_r, end_c];
                            msg = `${msg}（目标${fmtPos(target_r, target_c)} -> 起点${fmtPos(start_r, start_c)} -> 终点${fmtPos(end_r, end_c)}）`;
                        }
                    } else {
                        dice = this._runWithDestinyOverride(
                            piece,
                            () => DiceEngine.roll_double(),
                            result => result
                        );
                        if (dice === 0) {
                            const destroyed = MoleManager.destroy_all_graves(this.board);
                            success = true;
                            state_changed = true;
                            msg = `爆破鼹鼠出现！破坏了场上所有${destroyed}座墓`;
                        } else if (dice >= 50) {
                            const tunnelRes = MoleManager.dig_tunnel_v2(this.board, piece, target_piece, start_r, start_c, end_r, end_c);
                            success = tunnelRes[0];
                            msg = tunnelRes[1];
                            if (success) {
                                state_changed = true;
                                result_extra.tunnel_start_pos = [start_r, start_c];
                                result_extra.tunnel_end_pos = [end_r, end_c];
                                msg = `${msg}（目标${fmtPos(target_r, target_c)} -> 起点${fmtPos(start_r, start_c)} -> 终点${fmtPos(end_r, end_c)}）`;
                            }
                        } else {
                            success = false;
                            msg = `召唤鼹鼠失败（骰子${dice.toString().padStart(2, '0')}）`;
                        }
                    }
                } else if (skillType === 'tunnel_commit') {
                    skill_key = 'tunnel';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    const target_r = target_pos[1];
                    const target_c = target_pos[2];
                    const end_r = target_pos[3];
                    const end_c = target_pos[4];
                    const pending = piece.pending_tunnel;
                    if (!pending) {
                        return { success: false, message: '地道未准备，请先执行判定' };
                    }
                    if (pending.target_pos && (pending.target_pos[0] !== target_r || pending.target_pos[1] !== target_c)) {
                        return { success: false, message: '地道目标与准备阶段不一致' };
                    }
                    const target_piece = this._findPieceByUid(pending.target_uid) || this.board.get_top_piece(target_r, target_c);
                    if (!target_piece) {
                        piece.pending_tunnel = null;
                        return { success: false, message: '目标棋子已不存在' };
                    }
                    const tunnelRes = MoleManager.dig_tunnel(this.board, piece, target_piece, end_r, end_c);
                    success = tunnelRes[0];
                    msg = tunnelRes[1];
                    dice = null;
                    if (success) {
                        state_changed = true;
                        piece.pending_tunnel = null;
                    }
                } else if (skillType === 'tunnel') {
                    // 兼容旧格式: 一次请求完成 prepare+commit
                    skill_key = 'tunnel';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    const target_r = target_pos[1];
                    const target_c = target_pos[2];
                    const end_r = target_pos[3];
                    const end_c = target_pos[4];
                    const target_cell = this.board.get_cell(target_r, target_c);
                    if (!target_cell || target_cell.length === 0) {
                        return { success: false, message: '目标位置没有棋子' };
                    }
                    const target_piece = target_cell[target_cell.length - 1];
                    const summon_result = this._runWithDestinyOverride(
                        piece,
                        () => MoleManager.summon_mole(this.board, target_piece),
                        res => Array.isArray(res) ? res[1] : null
                    );
                    dice = summon_result[1];
                    if (!summon_result[0]) {
                        msg = summon_result[3] || '召唤鼹鼠失败';
                        success = false;
                    } else if (dice === 0) {
                        msg = summon_result[3];
                        success = true;
                        state_changed = true;
                    } else {
                        const tunnelRes = MoleManager.dig_tunnel(this.board, piece, target_piece, end_r, end_c);
                        success = tunnelRes[0];
                        msg = tunnelRes[1];
                        if (success) state_changed = true;
                    }
                } else if (skillType === 'destroy') {
                    skill_key = 'destroy';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    const grave_r = target_pos[1];
                    const grave_c = target_pos[2];
                    const cell = this.board.get_cell(grave_r, grave_c);
                    const has_grave = cell.some(p => p instanceof Grave);
                    if (!has_grave) {
                        return { success: false, message: '目标位置没有墓' };
                    }
                    [success, msg] = MoleManager.destroy_grave(this.board, grave_r, grave_c);
                    dice = null;
                    if (success) state_changed = true;
                } else {
                    skill_key = 'destroy';
                    if (!this.can_use_skill(piece, skill_key)) {
                        return { success: false, message: '该技能冷却中' };
                    }
                    const cell = this.board.get_cell(target_pos[0], target_pos[1]);
                    const has_grave = cell.some(p => p instanceof Grave);
                    if (!has_grave) {
                        return { success: false, message: '目标位置没有墓' };
                    }
                    [success, msg] = MoleManager.destroy_grave(this.board, target_pos[0], target_pos[1]);
                    dice = null;
                    if (success) state_changed = true;
                }
            } else if (piece.name === '魔笛手') {
                skill_key = 'destiny';
                if (!this.can_use_skill(piece, skill_key)) {
                    return { success: false, message: '该技能冷却中' };
                }
                if (!target_pos) {
                    return { success: false, message: '请选择一个目标施加命运骰' };
                }
                const skillType = (typeof target_pos[0] === 'string') ? target_pos[0] : 'destiny_success';
                const force_success = skillType !== 'destiny_fail';
                const target_r = skillType === 'destiny_success' || skillType === 'destiny_fail'
                    ? target_pos[1]
                    : target_pos[0];
                const target_c = skillType === 'destiny_success' || skillType === 'destiny_fail'
                    ? target_pos[2]
                    : target_pos[1];
                if (!Number.isInteger(target_r) || !Number.isInteger(target_c)) {
                    return { success: false, message: '命运骰目标坐标无效' };
                }
                const cell = this.board.get_cell(target_r, target_c);
                if (!cell || cell.length === 0) {
                    return { success: false, message: '目标无效' };
                }
                const target_piece = cell[cell.length - 1];
                if (target_piece.name === '魔笛手') {
                    return { success: false, message: '不能对魔笛手自身施加命运骰' };
                }
                [success, dice, msg] = PiperManager.destiny_dice(
                    this.board,
                    piece,
                    [target_piece],
                    force_success,
                    this.current_turn
                );
                if (success) state_changed = true;
            } else {
                return { success: false, message: `${piece.name} 没有可用的主动技能` };
            }

            if ((dice !== null || success) && mark_skill_action) {
                this.mark_skill_action();
            }

            if (immediateGameOver) {
                this.game_over = true;
                this.winner = immediateGameOver.winner;
                this.win_reason = immediateGameOver.win_reason;
                this.log_event(immediateGameOver.win_reason);
            }

            const autoTransformMsgs = [];
            let autoNightmareRolls = [];
            if (state_changed && !this.game_over) {
                this.reconcileGreenWifeComposite();
                refreshCitizenUpgradeFlags(this.board);
                const piperSuppressionMsgs = this._enforcePiperTerritorySuppression();
                this._syncTeamProgressFlags();
                this._refreshVFormationBindings();
                for (const pmsg of piperSuppressionMsgs) {
                    autoTransformMsgs.push(pmsg);
                    this.log_event(pmsg);
                }
                const transformed = this._tryAutoTransformYeAll(
                    (piece.team === 'black' || piece.team === 'white') ? piece.team : null
                );
                autoNightmareRolls = Array.isArray(transformed.nightmare_rolls)
                    ? transformed.nightmare_rolls.slice()
                    : [];
                for (const tmsg of (transformed.messages || [])) {
                    autoTransformMsgs.push(tmsg);
                    this.log_event(tmsg);
                }
            }
            if (success && skill_key && !require_tunnel_commit && !this.game_over) {
                this.add_skill_cooldown(piece, skill_key, 1);
            }

            if (autoTransformMsgs.length > 0) {
                msg = `${msg} | ${autoTransformMsgs.join(' | ')}`;
            }

            let log_msg = `【技能】${piece.team}方${piece.name}(${piece.symbol}) `;
            if (target_pos) {
                const pos = (target_pos && typeof target_pos[0] === 'string')
                    ? [target_pos[1], target_pos[2]]
                    : target_pos;
                if (pos && typeof pos[0] === 'number') {
                    const target_cell = this.board.get_cell(pos[0], pos[1]);
                    if (target_cell && target_cell.length > 0) {
                        const target = target_cell[target_cell.length - 1];
                        log_msg += `对${target.name}(${target.symbol}) `;
                    } else {
                        log_msg += `对${fmtPos(pos[0], pos[1])} `;
                    }
                }
            }
            log_msg += '发动技能 ';
            if (success) {
                log_msg += '成功!';
                if (dice !== null && dice !== undefined) log_msg += ` [骰子:${dice}]`;
            } else {
                log_msg += '失败.';
                if (dice !== null && dice !== undefined) log_msg += ` [骰子:${dice}]`;
            }
            log_msg += ` -> ${msg}`;

            this.log_event(log_msg);
            const result = { success, dice, message: msg, state_changed };
            if (this.game_over) {
                result.game_over = true;
                result.winner = this.winner;
                result.win_reason = this.win_reason;
            }
            if (autoNightmareRolls.length) {
                result.nightmare_rolls = autoNightmareRolls;
            }
            if (typeof direction_dice_result !== 'undefined') {
                result.direction_dice = direction_dice_result;
            }
            if (require_tunnel_commit) {
                result.need_tunnel_endpoint = true;
            }
            return Object.assign(result, result_extra);
        }
    }

    function isPieceLike(obj) {
        return !!(obj && typeof obj === 'object' && typeof obj.name === 'string' && Array.isArray(obj.position) && 'team' in obj && 'state' in obj);
    }

    function getPieceType(piece) {
        if (piece instanceof Grave) return 'grave';
        if (piece instanceof Citizen) return 'citizen';
        if (piece instanceof Lawyer) return 'lawyer';
        if (piece instanceof Doctor) return 'doctor';
        if (piece instanceof Police) return 'police';
        if (piece instanceof Teacher) return 'teacher';
        if (piece instanceof Officer) return 'officer';
        if (piece instanceof Ye) return 'ye';
        if (piece instanceof Nightmare) return 'nightmare';
        if (piece instanceof Wife) return 'wife';
        if (piece instanceof Child) return 'child';
        if (piece instanceof Mole) return 'mole';
        if (piece instanceof DeathGod) return 'deathgod';
        if (piece instanceof Monk) return 'monk';
        if (piece instanceof Piper) return 'piper';
        if (piece instanceof SquareDancer) return 'squaredancer';
        return (piece && piece.constructor && piece.constructor.name || 'piece').toLowerCase();
    }

    function serializeValue(value) {
        if (isPieceLike(value)) {
            return { __ref: ensureUid(value) };
        }
        if (Array.isArray(value)) {
            return value.map(item => serializeValue(item));
        }
        if (value && typeof value === 'object') {
            const out = {};
            for (const [key, val] of Object.entries(value)) {
                out[key] = serializeValue(val);
            }
            return out;
        }
        return value;
    }

    function serializePiece(piece) {
        const record = {
            uid: ensureUid(piece),
            type: getPieceType(piece),
            props: {}
        };
        for (const [key, val] of Object.entries(piece)) {
            record.props[key] = serializeValue(val);
        }
        return record;
    }

    function collectPieces(game) {
        const collected = new Map();
        const visit = (piece) => {
            if (!isPieceLike(piece)) return;
            const uid = ensureUid(piece);
            if (collected.has(uid)) return;
            collected.set(uid, piece);
            for (const val of Object.values(piece)) {
                if (isPieceLike(val)) {
                    visit(val);
                } else if (Array.isArray(val)) {
                    for (const item of val) {
                        if (isPieceLike(item)) visit(item);
                    }
                } else if (val && typeof val === 'object') {
                    for (const nested of Object.values(val)) {
                        if (isPieceLike(nested)) visit(nested);
                    }
                }
            }
        };

        for (let r = 0; r < game.board.size; r++) {
            for (let c = 0; c < game.board.size; c++) {
                const cell = game.board.get_cell(r, c);
                for (const piece of cell) {
                    visit(piece);
                }
            }
        }

        if (game.board.ghost_pool) {
            for (const piece of game.board.ghost_pool) {
                visit(piece);
            }
        }

        return Array.from(collected.values());
    }

    function serializeGame(game) {
        const pieces = collectPieces(game).map(serializePiece);
        const grid = game.board.grid.map(row => row.map(cell => cell.map(piece => ensureUid(piece))));
        const ghost_pool = (game.board.ghost_pool || []).map(piece => ensureUid(piece));
        return {
            version: 1,
            next_uid: Piece._next_uid,
            game: {
                current_turn: game.current_turn,
                turn_count: game.turn_count,
                phase: game.phase,
                action_taken: game.action_taken,
                skill_cooldowns: serializeValue(game.skill_cooldowns || {}),
                state_durations: serializeValue(game.state_durations || {}),
                log_history: Array.isArray(game.log_history) ? game.log_history.slice() : [],
                sandbox_mode: !!game.sandbox_mode,
                last_round_tick: game.last_round_tick || 0,
                team_swap_used: serializeValue(game.team_swap_used || { black: false, white: false }),
                death_god_zero_count: game.death_god_zero_count || 0,
                team_progress: serializeValue(game.team_progress || {
                    black: { wife_ready: false, child_ready: false },
                    white: { wife_ready: false, child_ready: false }
                }),
                v_formations: serializeValue(game.v_formations || {}),
                next_v_formation_id: game.next_v_formation_id || 1,
                nightmare_first_transform_done: !!game.nightmare_first_transform_done,
                game_over: !!game.game_over,
                winner: game.winner || null,
                win_reason: game.win_reason || null
            },
            board: {
                size: game.board.size,
                grid,
                ghost_pool
            },
            pieces
        };
    }

    function deserializeGame(payload) {
        if (!payload || !payload.board || !Array.isArray(payload.pieces)) {
            return new Game();
        }

        const pieceMap = new Map();

        for (const record of payload.pieces) {
            const props = record.props || {};
            const position = Array.isArray(props.position) ? props.position : [0, 0];
            const team = props.team || 'neutral';
            let piece;
            if (record.type === 'grave') {
                const dummy = {
                    name: props.original_name || props.name || '墓',
                    symbol: props.original_symbol || props.symbol || '墓',
                    team: props.original_team || 'neutral',
                    position
                };
                piece = new Grave(dummy);
            } else {
                try {
                    piece = create_piece(record.type, team, position);
                } catch (err) {
                    piece = new Piece(props.name || '未知', props.symbol || '?', team, position);
                }
            }
            piece.uid = record.uid;
            pieceMap.set(record.uid, piece);
        }

        const resolveValue = (value) => {
            if (value && typeof value === 'object' && value.__ref) {
                return pieceMap.get(value.__ref) || null;
            }
            if (Array.isArray(value)) {
                return value.map(item => resolveValue(item));
            }
            if (value && typeof value === 'object') {
                const out = {};
                for (const [key, val] of Object.entries(value)) {
                    out[key] = resolveValue(val);
                }
                return out;
            }
            return value;
        };

        for (const record of payload.pieces) {
            const piece = pieceMap.get(record.uid);
            if (!piece) continue;
            for (const [key, val] of Object.entries(record.props || {})) {
                piece[key] = resolveValue(val);
            }
        }

        const board = new Board();
        board.size = payload.board.size || board.size;
        board.grid = payload.board.grid.map(row => row.map(cell => cell.map(uid => pieceMap.get(uid)).filter(Boolean)));
        board.ghost_pool = (payload.board.ghost_pool || []).map(uid => pieceMap.get(uid)).filter(Boolean);

        const game = new Game();
        game.board = board;
        if (payload.game) {
            game.current_turn = payload.game.current_turn;
            game.turn_count = payload.game.turn_count;
            game.phase = payload.game.phase;
            game.action_taken = payload.game.action_taken;
            game.skill_cooldowns = resolveValue(payload.game.skill_cooldowns || {});
            game.state_durations = resolveValue(payload.game.state_durations || {});
            game.log_history = Array.isArray(payload.game.log_history) ? payload.game.log_history.slice() : [];
            game.sandbox_mode = !!payload.game.sandbox_mode;
            game.last_round_tick = payload.game.last_round_tick || 0;
            game.team_swap_used = resolveValue(payload.game.team_swap_used || { black: false, white: false });
            game.death_god_zero_count = payload.game.death_god_zero_count || 0;
            game.team_progress = resolveValue(payload.game.team_progress || {
                black: { wife_ready: false, child_ready: false },
                white: { wife_ready: false, child_ready: false }
            });
            game.v_formations = resolveValue(payload.game.v_formations || {});
            game.next_v_formation_id = payload.game.next_v_formation_id || 1;
            game.nightmare_first_transform_done = !!payload.game.nightmare_first_transform_done;
            game.game_over = !!payload.game.game_over;
            game.winner = payload.game.winner || null;
            game.win_reason = payload.game.win_reason || null;
        }

        const maxUid = pieceMap.size ? Math.max(...pieceMap.keys()) : 0;
        Piece._next_uid = Math.max(payload.next_uid || 1, maxUid + 1);
        return game;
    }

    class MoleChessAI {
        constructor() {
            this.lastLog = [];
        }

        getBestAction(game) {
            if (!game || game.game_over) return null;

            const actions = this._generateActions(game);
            if (!actions.length) return null;

            const team = game.current_turn;
            const opponent = team === 'black' ? 'white' : 'black';
            const opponentChildAlive = this._hasAliveChild(game, opponent);

            const scored = [];
            for (const action of actions) {
                const scoredAction = this._scoreAction(game, action, team, opponent, opponentChildAlive);
                if (scoredAction) scored.push(scoredAction);
            }

            if (!scored.length) return null;

            scored.sort((a, b) => {
                if (a.killPriority !== b.killPriority) {
                    return b.killPriority - a.killPriority;
                }
                return b.finalScore - a.finalScore;
            });

            const best = scored[0];
            const top = scored.slice(0, 3).map(entry => {
                const label = this._describeAction(entry.action);
                const tags = entry.tags.length ? ` [${entry.tags.join(', ')}]` : '';
                return `${label} => ${entry.expectedScore.toFixed(1)}${tags}`;
            });

            const reasonTags = best.tags.length ? `（${best.tags.join('、')}）` : '';
            const reason = `选择${this._describeAction(best.action)}，预期收益最高${reasonTags}`;

            this.lastLog = top;
            return {
                action: best.action,
                expectedScore: best.expectedScore,
                reason,
                aiLog: top
            };
        }

        _scoreAction(game, action, team, opponent, opponentChildAlive) {
            const outcomeSpecs = this._getOutcomeSpecs(action);
            if (!outcomeSpecs.length) return null;

            let expectedScore = 0;
            let hasMeaningful = false;
            let killPriority = 0;
            const tags = [];

            for (const outcome of outcomeSpecs) {
                const sim = this._simulateAction(game, action, outcome.rolls);
                if (!sim || !sim.simGame) continue;

                let score = sim.simGame.evaluateBoard(team);

                if (game.death_god_zero_count === 2 && this._childInDeathGodZone(sim.simGame, team)) {
                    score -= 5000;
                    if (!tags.includes('避死神')) tags.push('避死神');
                }

                expectedScore += score * outcome.prob;

                if (sim.result && (sim.result.success || sim.result.state_changed)) {
                    hasMeaningful = true;
                }

                if (opponentChildAlive && !this._hasAliveChild(sim.simGame, opponent)) {
                    killPriority = 1;
                }
            }

            if (!hasMeaningful) {
                expectedScore -= 5;
            }

            let finalScore = expectedScore;

            if (killPriority) {
                finalScore += 100000;
                if (!tags.includes('斩杀线')) tags.push('斩杀线');
            }

            if (action.formation) {
                if (!tags.includes('V阵型')) tags.push('V阵型');
            }

            const bonus = this._actionContextBonus(game, action, team);
            if (bonus !== 0) {
                finalScore += bonus;
                if (bonus > 0 && !tags.includes('关键策略')) tags.push('关键策略');
            }

            return {
                action,
                expectedScore,
                finalScore,
                killPriority,
                tags
            };
        }

        _actionContextBonus(game, action, team) {
            const board = game.board;
            let bonus = 0;

            if (action.type === 'skill' && action.pieceName === '广场舞大妈') {
                if (Array.isArray(action.targetPos) && typeof action.targetPos[0] === 'number') {
                    const targetPiece = this._getTopPiece(board, action.targetPos[0], action.targetPos[1]);
                    if (targetPiece && targetPiece.team !== team && (targetPiece.name === '夜魔' || targetPiece.is_nightmare)) {
                        const dancerPos = action.from;
                        const dist = this._chebyshevDistance(dancerPos, [action.targetPos[0], action.targetPos[1]]);
                        if (dist <= 2) {
                            bonus += 300;
                        }
                    }
                }
            }

            const enemyPiperInTerritory = this._isEnemyPiperInTerritory(game, team);
            if (enemyPiperInTerritory && action.type === 'skill' && action.pieceName === '警察') {
                if (Array.isArray(action.targetPos) && typeof action.targetPos[0] === 'number') {
                    const targetPiece = this._getTopPiece(board, action.targetPos[0], action.targetPos[1]);
                    if (targetPiece && targetPiece.name === '魔笛手' && targetPiece.team !== team) {
                        bonus += 500;
                    }
                }
            }

            return bonus;
        }

        _generateActions(game) {
            const actions = [];
            const board = game.board;

            for (let r = 0; r < board.size; r++) {
                for (let c = 0; c < board.size; c++) {
                    const cell = board.get_cell(r, c);
                    if (!cell || cell.length === 0) continue;
                    const piece = cell[cell.length - 1];
                    if (!piece || piece.state !== 'alive') continue;
                    if (!game.can_control_piece(piece)) continue;

                    const pos = [r, c];

                    if (piece.name === '市民') {
                        const vRes = CitizenManager.is_in_v_formation(board, piece);
                        if (vRes[0]) {
                            actions.push({ type: 'move', from: pos, to: pos, formation: true, pieceName: piece.name });
                            continue;
                        }
                    }

                    const moves = piece.get_valid_moves(board) || [];
                    for (const move of moves) {
                        actions.push({ type: 'move', from: pos, to: move, pieceName: piece.name });
                    }

                    actions.push(...this._generateSkillActions(game, piece, pos));

                    if (piece.name === '市民' && piece.can_upgrade) {
                        for (const upgradeTo of ['police', 'officer', 'lawyer', 'teacher', 'doctor']) {
                            actions.push({ type: 'upgrade', pos, upgradeTo, pieceName: piece.name });
                        }
                    }
                }
            }

            return actions;
        }

        _generateSkillActions(game, piece, pos) {
            const actions = [];
            const board = game.board;

            if (!game.can_use_skill_action()) return actions;

            if (piece.name === '孩子' && !piece.is_red_child) {
                actions.push({ type: 'skill', from: pos, targetPos: null, skill: 'child_learn', pieceName: piece.name });
            }

            if (piece.name === '妻子') {
                for (let i = 0; i < board.size; i++) {
                    for (let j = 0; j < board.size; j++) {
                        const target = this._getTopPiece(board, i, j);
                        if (target && target.state === 'alive' && target.name === '市民' && target.team === piece.team) {
                            actions.push({
                                type: 'skill',
                                from: pos,
                                targetPos: [i, j],
                                skill: 'wife_possess',
                                pieceName: piece.name
                            });
                        }
                    }
                }
            }

            if (piece.name === '夜魔') {
                if (typeof piece.can_move_now === 'function' && !piece.can_move_now()) {
                    return actions;
                }
                const moves = piece.get_valid_moves(board) || [];
                for (const move of moves) {
                    actions.push({
                        type: 'skill',
                        from: pos,
                        targetPos: ['crush', move[0], move[1]],
                        skill: 'nightmare_crush',
                        pieceName: piece.name
                    });
                }
            }

            if (piece.name === '警察') {
                const arrestTargets = typeof piece.get_arrest_targets === 'function'
                    ? piece.get_arrest_targets(board)
                    : [];
                for (const [i, j] of arrestTargets) {
                    actions.push({
                        type: 'skill',
                        from: pos,
                        targetPos: [i, j],
                        skill: 'police_arrest',
                        pieceName: piece.name
                    });
                }
            }

            if (piece.name === '医生') {
                const [px] = piece.position;
                for (let i = 0; i < board.size; i++) {
                    if (Math.abs(i - px) > 1) continue;
                    for (let j = 0; j < board.size; j++) {
                        const cell = board.get_cell(i, j);
                        if (!cell || cell.length === 0) continue;
                        const topGrave = cell[cell.length - 1];
                        if (!(topGrave instanceof Grave)) continue;
                        if (topGrave.original_team !== piece.team) continue;
                        actions.push({
                            type: 'skill',
                            from: pos,
                            targetPos: [i, j],
                            skill: 'doctor_resurrect',
                            pieceName: piece.name
                        });
                    }
                }
            }

            if (piece.name === '官员') {
                const lawyers = [];
                if (!game.team_swap_used[piece.team]) {
                    for (let i = 0; i < board.size; i++) {
                        for (let j = 0; j < board.size; j++) {
                            const target = this._getTopPiece(board, i, j);
                            if (target && target.state === 'alive' && target.name === '律师' && target.team === piece.team) {
                                lawyers.push([i, j]);
                            }
                        }
                    }
                }
                for (const [i, j] of lawyers) {
                    actions.push({
                        type: 'skill',
                        from: pos,
                        targetPos: [i, j],
                        skill: 'officer_swap',
                        pieceName: piece.name
                    });
                }

                if (board.ghost_pool && board.ghost_pool.length > 0) {
                    const rows = piece.team === 'black' ? [0, 1] : [10, 11];
                    for (const row of rows) {
                        for (let col = 0; col < board.size; col++) {
                            if (board.get_cell(row, col).length === 0) {
                                actions.push({
                                    type: 'skill',
                                    from: pos,
                                    targetPos: [row, col],
                                    skill: 'officer_summon',
                                    pieceName: piece.name
                                });
                            }
                        }
                    }
                }
            }

            if (piece.name === '律师') {
                if (!game.team_swap_used[piece.team]) {
                    for (let i = 0; i < board.size; i++) {
                        for (let j = 0; j < board.size; j++) {
                            const target = this._getTopPiece(board, i, j);
                            if (target && target.state === 'alive' && target.name === '官员' && target.team === piece.team) {
                                actions.push({
                                    type: 'skill',
                                    from: pos,
                                    targetPos: [i, j],
                                    skill: 'lawyer_swap',
                                    pieceName: piece.name
                                });
                            }
                        }
                    }
                }
            }

            if (piece.name === '僧侣') {
                if (piece.active_saved_uid) {
                    const activeSaved = typeof game._findPieceByUid === 'function'
                        ? game._findPieceByUid(piece.active_saved_uid)
                        : null;
                    if (activeSaved && activeSaved.state === 'alive' && activeSaved.is_saved) {
                        return actions;
                    }
                }
                for (let i = 0; i < board.size; i++) {
                    for (let j = 0; j < board.size; j++) {
                        const target = this._getTopPiece(board, i, j);
                        if (!target) continue;
                        if (target.state !== 'alive') continue;
                        if (target.name === '死神') continue;
                        actions.push({
                            type: 'skill',
                            from: pos,
                            targetPos: [i, j],
                            skill: 'monk_save',
                            pieceName: piece.name
                        });
                    }
                }
            }

            if (piece.name === '广场舞大妈') {
                for (let i = 0; i < board.size; i++) {
                    for (let j = 0; j < board.size; j++) {
                        const target = this._getTopPiece(board, i, j);
                        if (!target || target.state !== 'alive') continue;
                        if (target.team === 'neutral') continue;
                        if (target.position[0] === pos[0] && target.position[1] === pos[1]) continue;
                        actions.push({
                            type: 'skill',
                            from: pos,
                            targetPos: [i, j],
                            skill: 'squaredancer_vortex',
                            pieceName: piece.name
                        });
                    }
                }
            }

            if (piece.name === '魔笛手') {
                for (let i = 0; i < board.size; i++) {
                    for (let j = 0; j < board.size; j++) {
                        const target = this._getTopPiece(board, i, j);
                        if (!target || target.state !== 'alive' || target.name === '魔笛手') continue;
                        actions.push({
                            type: 'skill',
                            from: pos,
                            targetPos: [i, j],
                            skill: 'piper_destiny',
                            pieceName: piece.name
                        });
                    }
                }
            }

            if (piece.name === '鼹鼠') {
                for (let i = 0; i < board.size; i++) {
                    for (let j = 0; j < board.size; j++) {
                        const cell = board.get_cell(i, j);
                        if (!cell || cell.length === 0) continue;
                        if (cell.some(p => p instanceof Grave)) {
                            actions.push({
                                type: 'skill',
                                from: pos,
                                targetPos: ['destroy', i, j],
                                skill: 'mole_destroy',
                                pieceName: piece.name
                            });
                        }
                    }
                }

                const tunnelTargets = this._getTunnelTargets(board);
                for (const target of tunnelTargets) {
                    const predicted = this._predictMolePosForTunnel(board, target);
                    if (!predicted) continue;
                    const endSquares = this._getAlignedEmptySquares(board, predicted);
                    for (const end of endSquares) {
                        actions.push({
                            type: 'skill',
                            from: pos,
                            targetPos: ['tunnel', target.position[0], target.position[1], end[0], end[1]],
                            skill: 'mole_tunnel',
                            pieceName: piece.name
                        });
                    }
                }
            }

            return actions.filter(action => !this._targetsDeathGod(board, action.targetPos));
        }

        _getOutcomeSpecs(action) {
            if (action.type !== 'skill') {
                return [{ label: 'deterministic', prob: 1, rolls: null }];
            }

            const diceSkills = new Set([
                'child_learn',
                'wife_possess',
                'police_arrest',
                'doctor_resurrect',
                'officer_summon',
                'monk_save',
                'piper_destiny',
                'squaredancer_vortex',
                'mole_tunnel'
            ]);

            if (!diceSkills.has(action.skill)) {
                return [{ label: 'deterministic', prob: 1, rolls: null }];
            }

            if (action.skill === 'squaredancer_vortex') {
                return [
                    { label: 'vortex_critical', prob: 0.01, rolls: this._doubleToRolls(0) },
                    { label: 'vortex_success', prob: 0.5, rolls: [...this._doubleToRolls(50), 4] },
                    { label: 'vortex_fail', prob: 0.49, rolls: this._doubleToRolls(1) }
                ];
            }

            return [
                { label: 'critical', prob: 0.01, rolls: this._doubleToRolls(0) },
                { label: 'success', prob: 0.5, rolls: this._doubleToRolls(50) },
                { label: 'fail', prob: 0.49, rolls: this._doubleToRolls(1) }
            ];
        }

        _simulateAction(game, action, rolls) {
            const prevUid = Piece._next_uid;

            const run = () => {
                const simGame = game.clone();
                let result = null;

                if (action.type === 'move') {
                    result = simGame.applyMove(action.from, action.to);
                } else if (action.type === 'skill') {
                    const piece = this._getTopPiece(simGame.board, action.from[0], action.from[1]);
                    if (!piece) {
                        return null;
                    }
                    result = simGame.use_skill(piece, action.targetPos || null);
                } else if (action.type === 'upgrade') {
                    const [x, y] = action.pos;
                    const cell = simGame.board.get_cell(x, y);
                    if (!cell || cell.length === 0) return null;
                    const piece = cell[cell.length - 1];
                    if (piece.name !== '市民' || !piece.can_upgrade) return null;
                    const upgradeRes = CitizenManager.citizen_upgrade(simGame.board, piece, action.upgradeTo);
                    result = { success: upgradeRes[0], message: upgradeRes[1] };
                    if (result.success) {
                        simGame.log_event(upgradeRes[1]);
                    }
                }

                return { simGame, result };
            };

            let outcome;
            if (rolls && rolls.length) {
                outcome = DiceEngine.withForcedRolls(rolls, run);
            } else {
                outcome = run();
            }

            Piece._next_uid = prevUid;
            return outcome;
        }

        _hasAliveChild(game, team) {
            const board = game.board;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.team !== team || piece.state !== 'alive') continue;
                        if (piece.name === '孩子' || piece.name === '红叶儿' || piece.is_red_child) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        _childInDeathGodZone(game, team) {
            const board = game.board;
            let deathGodPos = null;
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.name === '死神') {
                            deathGodPos = [i, j];
                        }
                    }
                }
            }
            if (!deathGodPos) return false;

            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const cell = board.get_cell(i, j);
                    for (const piece of cell) {
                        if (piece.team !== team || piece.state !== 'alive') continue;
                        if (!(piece.name === '孩子' || piece.name === '红叶儿' || piece.is_red_child)) continue;
                        const dist = this._chebyshevDistance(piece.position, deathGodPos);
                        if (dist <= 1) return true;
                    }
                }
            }
            return false;
        }

        _isEnemyPiperInTerritory(game, team) {
            const board = game.board;
            const enemy = team === 'black' ? 'white' : 'black';
            const rows = team === 'black' ? [0, 1] : [10, 11];
            for (const r of rows) {
                for (let c = 0; c < board.size; c++) {
                    const piece = this._getTopPiece(board, r, c);
                    if (piece && piece.team === enemy && piece.name === '魔笛手') {
                        return true;
                    }
                }
            }
            return false;
        }

        _getTopPiece(board, x, y) {
            const cell = board.get_cell(x, y);
            if (cell && cell.length > 0) return cell[cell.length - 1];
            return null;
        }

        _extractTargetPos(targetPos) {
            if (!Array.isArray(targetPos)) return null;
            if (Number.isInteger(targetPos[0]) && Number.isInteger(targetPos[1])) {
                return [targetPos[0], targetPos[1]];
            }
            if (
                typeof targetPos[0] === 'string'
                && Number.isInteger(targetPos[1])
                && Number.isInteger(targetPos[2])
                && ['crush', 'destroy', 'tunnel_prepare', 'tunnel_path', 'tunnel', 'tunnel_commit', 'destiny_success', 'destiny_fail'].includes(targetPos[0])
            ) {
                return [targetPos[1], targetPos[2]];
            }
            return null;
        }

        _targetsDeathGod(board, targetPos) {
            const pos = this._extractTargetPos(targetPos);
            if (!pos) return false;
            const cell = board.get_cell(pos[0], pos[1]) || [];
            return cell.some(p => p && p.name === '死神');
        }

        _getTunnelTargets(board) {
            const targets = [];
            for (let i = 0; i < board.size; i++) {
                for (let j = 0; j < board.size; j++) {
                    const target = this._getTopPiece(board, i, j);
                    if (!target) continue;
                    if (target.state !== 'alive') continue;
                    if (target.name === '死神' || target.name === '鼹鼠') continue;
                    targets.push(target);
                }
            }
            return targets;
        }

        _predictMolePosForTunnel(board, targetPiece) {
            const directions = [
                [-1, 0], [1, 0], [0, -1], [0, 1],
                [-1, -1], [-1, 1], [1, -1], [1, 1]
            ];
            const [x, y] = targetPiece.position;
            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                if (!board.is_valid_position(nx, ny)) continue;
                if (board.get_cell(nx, ny).length === 0) {
                    return [nx, ny];
                }
            }
            return null;
        }

        _getAlignedEmptySquares(board, startPos) {
            const [sx, sy] = startPos;
            const aligned = [];
            for (let x = 0; x < board.size; x++) {
                for (let y = 0; y < board.size; y++) {
                    if (board.get_cell(x, y).length > 0) continue;
                    const dx = x - sx;
                    const dy = y - sy;
                    if (dx === 0 && dy === 0) continue;
                    if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
                        aligned.push([x, y]);
                    }
                }
            }
            return aligned;
        }

        _doubleToRolls(value) {
            const tens = Math.floor(value / 10);
            const ones = value % 10;
            return [tens, ones];
        }

        _chebyshevDistance(a, b) {
            return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
        }

        _describeAction(action) {
            if (action.type === 'move') {
                const from = n2a(action.from[0], action.from[1]);
                const to = n2a(action.to[0], action.to[1]);
                if (action.formation) {
                    return `V阵型推进(${from})`;
                }
                return `${action.pieceName} ${from}->${to}`;
            }
            if (action.type === 'upgrade') {
                const pos = n2a(action.pos[0], action.pos[1]);
                const upgradeMap = {
                    police: '警察',
                    officer: '官员',
                    lawyer: '律师',
                    teacher: '老师',
                    doctor: '医生'
                };
                return `升变市民(${pos})为${upgradeMap[action.upgradeTo] || action.upgradeTo}`;
            }
            if (action.type === 'skill') {
                const from = n2a(action.from[0], action.from[1]);
                let targetDesc = '';
                if (Array.isArray(action.targetPos) && typeof action.targetPos[0] === 'number') {
                    targetDesc = ` -> ${n2a(action.targetPos[0], action.targetPos[1])}`;
                } else if (Array.isArray(action.targetPos) && typeof action.targetPos[0] === 'string') {
                    if (action.targetPos.length >= 3) {
                        targetDesc = ` -> ${n2a(action.targetPos[1], action.targetPos[2])}`;
                    }
                }
                return `${action.pieceName}技能@${from}${targetDesc}`;
            }
            return '未知动作';
        }
    }

    global.MoleChessCore = {
        CoordinateConverter,
        a2n,
        n2a,
        DiceEngine,
        Board,
        Piece,
        Citizen,
        Lawyer,
        Doctor,
        Ye,
        Nightmare,
        Wife,
        Child,
        Police,
        Teacher,
        Officer,
        Mole,
        DeathGod,
        Monk,
        Piper,
        SquareDancer,
        Grave,
        SkillManager,
        PoliceManager,
        OfficerSkillManager,
        MonkManager,
        PiperManager,
        SquareDancerManager,
        MoleManager,
        NightmareManager,
        TransformationManager,
        DeathGodManager,
        LifeCycleManager,
        CitizenManager,
        LawyerManager,
        create_piece,
        capture_piece,
        Game,
        ensureUid,
        serializeGame,
        deserializeGame,
        MoleChessAI
    };
})(typeof window !== 'undefined' ? window : globalThis);
