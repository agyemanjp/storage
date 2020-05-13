import { cloneDeep, mergeWith } from "lodash"

// import * as shortid from "shortid"
type Obj<TValue = any, TKey extends string = string> = { [key in TKey]: TValue }
type Primitive = number | string /*| boolean*/ | Date

export type Comparer<X = any, Y = number> = (a?: X, b?: X) => Y
export type Projector<X = any, Y = any, I = number> = (value: X, index?: I) => Y;
export type AsyncProjector<X = any, Y = any, I = number> = (value: X, index?: I) => Promise<Tuple<I, Y>>;
export type Predicate<X = any, I = number> = (value: X, index?: I) => boolean;
export type Reducer<X = any, Y = any, I = number> = (prev: Y, current: X, index?: I, collection?: Iterable<X>) => Y;

export interface KeyValuePair<TKey = any, TValue = any> { key: TKey, value: TValue }
export type Tuple<X, Y> = [X, Y]
export const Tuple = class <X, Y>  {
	constructor(x: X, y: Y) {
		return [x, y] as Tuple<X, Y>
	}
} as { new <X, Y>(x: X, y: Y): [X, Y] }

export class String__ extends String {
	constructor(str: string) {
		super(str)
	}

	isWhiteSpace(): boolean {
		return this.replace(/^\s+|\s+$/g, '').length === 0;
	}

	getCharacters(): Array__<String__> {
		let _arr = Array__.fromLength<String__>(this.length);
		for (let index = 0; index < this.length; index++) {
			console.assert(this[index] != null, `String.getCharacters(): char as index ${index} is undefined`)

			let str = new String__(this[index])
			console.assert(str, `String.getCharacters(): new String is undefined`)

			_arr.set({ index: index, value: str })
		}

		return _arr
	}

	getArrayFromCsv<T extends Primitive>(): Array__<T> {
		const _arr = new Array__<T>()
		if (this[0] !== "," || this[this.length - 1] !== ",") {
			throw new Error("The string is not properly formatted")
		}

		return this.substring(1, this.length - 1) === ""
			? new Array__<T>()
			: new Array__<T>(this.substring(1, this.length - 1).split(",") as T[])
	}

	trimLeft(...strings: string[]) {
		let str = this.toString()
		strings.forEach(_str => {
			if (str.toLowerCase().startsWith(_str.toLowerCase()))
				str = str.substr(_str.length)
		})

		return str
	}
	trimRight(...strings: string[]) {
		let str = this.toString()
		strings.forEach(_str => {
			if (str.toLowerCase().endsWith(_str.toLowerCase()))
				str = str.substr(0, str.length - _str.length)
		})

		return str
	}

	tokenizeWords(separateCaseBoundary: "upper" | "lower" | "all" | "none" = "none", seperatorChars?: string[]): Array__<String__> {
		//console.log(`starting tokenizeWords for "${this.valueOf()}"`)
		var separators = seperatorChars || [" ", "\t"]
		//console.log(`effective separators are "${separators}"`)

		var words: string[] = []
		var currentWord = ""
		var lastChar = this[0]

		let pushWord = (str: string = "") => {
			if (currentWord.length > 0) {
				words.push(currentWord)
				//console.log(`pushed ${currentWord} to words, now ${JSON.stringify(words)}`)
			}

			//console.log(`set currentWord to ${str}`)
			currentWord = str
		}

		let chars = this.getCharacters()
		//console.log(`chars array: ${JSON.stringify(chars)}`)

		for (let ch of chars) {
			console.assert(ch, `String.tokenizeWords(): ch is undefined`)
			//console.log(`testing char "${ch.valueOf()}"`)

			if (separators.includes(ch.valueOf())) {
				//console.log(`separators include char tested, will push ${currentWord} to words`)
				pushWord()
			}
			else {
				//console.log(`separators do not include char tested, testing for case boundary`)

				let nowCase = ch.getCase()
				let lastCase = new String__(lastChar).getCase()

				let test = (
					(separateCaseBoundary === "none") ||
					(separators.includes(lastChar)) ||
					(lastCase === undefined) ||
					(nowCase === undefined) ||
					(nowCase !== separateCaseBoundary) ||
					(nowCase === lastCase)
				)

				if (test === false) {
					//console.log(`case boundary test is true, pushing `)
					pushWord(ch.valueOf())
				}
				else {
					//console.log(`case boundary test is false, concatenating char to currentWord`)

					currentWord = currentWord.concat(ch.valueOf())
					//console.log(`currentWord concatenated to ${currentWord}`)
				}
			}
			// TTLoUKmidiForm
			// TTL-o-UK-midi-F-orm
			lastChar = ch.valueOf()
			//console.log(`lastChar set to ${lastChar}`)
		}

		//console.log(`Outta loop, pushing currentWord "${currentWord}" to words`)
		pushWord()
		return new Array__(words).map(x => new String__(x))
	}

	toSnakeCase() {
		return new String__(this.tokenizeWords("upper", ["-", "_", " ", "    ", "\t"]).join("_"))
	}
	toCamelCase() {
		return this.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
			return index === 0 ? word.toLowerCase() : word.toUpperCase();
		}).replace(/\s+/g, '');
	}
	toSpace() {
		return new String__(this.tokenizeWords("upper", ["-", "_", " ", "    ", "\t"]).join(" "))
	}
	toTitleCase() {
		let str = this.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
		return new String__(str)
	}

    /**
	 * Shorten a string by placing an ellipsis at the middle of it.
     * @param maxLen is the maximum length of the new shortened string
	 */
	shorten(maxLen: number) {
		let title = this.toString()
		if (title.length <= maxLen) return new String__(title);

		let i = 0, j = title.length - 1;
		let left = "", right = "";
		let leftCount = 0, rightCount = 0;

		while (true) {
			left += title[i];
			leftCount += 1;
			i += 1;
			if (leftCount + rightCount + 3 >= maxLen) break;

			right += title[j];
			rightCount += 1;
			j -= 1;
			if (leftCount + rightCount + 3 >= maxLen) break;
		}
		right = right.split("").reverse().join("")

		return new String(left + "..." + right)
	}

	isUpperCase() {
		return this.toUpperCase() === this.valueOf()
	}
	isLowerCase() {
		return this.toLowerCase() === this.valueOf()
	}

    /**
     * returns the case of input string
     * if string contains only special characters, 'upper' is returned
     * @param str the input string
     */
	getCase(): "upper" | "lower" | undefined {
		if (this.toLowerCase() === this.toUpperCase())
			return undefined
		else if (this.isUpperCase())
			return "upper"
		else
			return "lower"
	}

	strip(chars: string[]) {
		if (!Array.isArray(chars))
			throw `String.strip(): Invalid chars argument type; expected 'Array'; found ${typeof (chars)}`;

		var result = "";
		for (var i = 0; i < this.length; i++) {
			if (chars.indexOf(this[i]) < 0) result += this[i];
		}
		return result
	}

    /**
     * Transforms single or multiple consecutive white-space characters into single spaces
     * @param chars
     */
	cleanWhitespace(chars?: string[]) {
		if (["null", "undefined", "array"].indexOf(typeof (chars)) < 0)
			throw `String.cleanWhitespace(): Invalid chars argument type; expected 'null', 'undefined', or 'array'; found ${typeof (chars)}`;

		var _chars = !(chars) ? ["\n", "\t", "\v", "\r"] : chars;
		var result = "";

		for (var i = 0; i < this.length; i++) {
			let val = this[i];
			result += (_chars.indexOf(val) < 0 ? val : " ")
		}
		return result.split(/[ ]{2,}/g).join(" ");
	}

	isEmptyOrWhitespace() {
		return this.strip([" ", "\n", "\t", "\v", "\r"]).length === 0;
	}

	plural() {
		if (this.endsWith("y")) {
			return new String__(this.substr(0, this.length - 1) + "ies")
		}
		else if (this.endsWith("sis")) {
			return new String__(this.substr(0, this.length - 3) + "ses")
		}
		else if (this.endsWith("s") || this.endsWith("x")) {
			return new String__(this + "es")
		}
		else {
			return new String__(this + "s")
		}
	}

	splitIntoChunks(size: number) {
		const numChunks = Math.ceil(this.length / size)
		const chunks = new Array(numChunks)

		for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
			chunks[i] = this.substr(o, size)
		}

		return chunks
	}

	isURL(): boolean {
		var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
			'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.+)+[a-z]{2,}|' + // domain name
			'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
			'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
			'(\\?[;&a-z\\d%_.~+=\\*-]*)?' + // query string
			'(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
		return pattern.test(this.toString());
	}
}

export class Array__<TValue = any> {
	readonly length: number

	constructor(items?: TValue[]) {
		this.length = items ? items.length : 0;
		for (let index = 0; index < this.length; index++) {
			(this as any)[index] = items![index];
		}
	}

	[Symbol.iterator]() {
		let _index = 0
		return {
			next: () => _index < this.length
				? { value: this.get(_index++)!, done: false }
				: { done: true } as IteratorResult<TValue>
		}
	}
    /*
        [Symbol.iterator] = function* () {
            for (var _index = 0; _index < this.length; _index++)
                yield (() => {
                    let val = this[_index] as TValue
                    //console.log(`returning ${val} in Array__ iterator`)

                    return val
                })() as TValue;
        }.bind(this)

        [Symbol.iterator] = this._arr[Symbol.iterator]
        [Symbol.iterator](): Iterator<TValue|undefined> {
            return {
                next: (value?: any): IteratorResult<TValue|undefined> => {
                    return {
                        done: true,
                        value: undefined
                    }
                }
            }
        }
    */

	static fromLength<T>(length: number = 0): Array__<T> { return new Array__<T>(new global.Array(length)); }
	static fromArguments<T>(...args: T[]): Array__<T> {
		return new Array__<T>(Array.prototype.slice.call(arguments))
	}
	static fromIterable<T>(arr: Iterable<T>): Array__<T> { return new Array__<T>(Array.from(arr)) }

	static fromRange(from: number, to: number, opts?: { mode: "width", width: number } | { mode: "count", count: number }): Array__<number> {
		if (opts) {
			if (opts.mode === "width" && opts.width <= 0) throw new Error("width must be positive non-zero number")
			if (opts.mode === "count" && opts.count <= 0) throw new Error("count must be positive non-zero number")
		}

		let diff = to - from
		let sign = to >= from ? 1 : -1
		let delta = opts === undefined
			? sign
			: opts.mode === "width"
				? (opts.width * sign)
				: diff / opts.count


		let length = Math.floor(diff / delta) + 1

		let arr = new global.Array<number>()
		for (var value = from; arr.length < length; value += delta) {
			arr.push(value)
		}

		return new Array__(arr)
	}

	clone() {
		return new Array__(this.getArray());
	}
	deepClone() {
		throw new Error(`Not Implemented`)
	}

	isDuplicated(element: TValue) {
		var alreadyOccured = false;
		for (var i = 0; i < this.length; i++) {
			if (this[i] === element) {
				if (alreadyOccured) {
					return true;
				}
				alreadyOccured = true;
			}
		}
		return false
	}

	getArray(): TValue[] {
		let _arr = new global.Array(this.length)
		for (let index = 0; index < this.length; index++)
			_arr[index] = (this as any)[index];

		return _arr;
	}

	getStringifiedArray(): string {
		return `,${this.join(",")},`
	}

	getObject(): Obj<TValue> {
		let obj = {} as Obj
		for (let index = 0; index < this.length; index++)
			obj[index] = (this as any)[index];

		return obj;
	}

	getNumbers(projector?: Projector<TValue, number>) {
		return this
			.map(datum => {
				if (datum === undefined) { throw new Error(`Tried to call getNumber() on an array including undefined values`) }
				let value = projector ? projector(datum) : datum
				return typeof (value) === "number"
					? value : Number.parseFloat(value.toString())
			})
			.filter(num => Number.isNaN(num) === false)
	}

	get(index: number): TValue | undefined
	get(indices: Iterable<number>): TValue[]
	get(...indices: number[]): TValue[]
	get(selection: number | Iterable<number>) {
		try {
			if (typeof selection === "number")
				return (this as any)[selection]
			else
				return [...selection].map(index => (this as any)[index])
		}
		catch (e) {
			console.error(`Error in Array__.get(); selection is: ${selection}; typeof selection is: ${typeof selection}`)
			throw e
		}
	}

	set(...keyValues: { value: TValue, index: number }[]): Array__<TValue> {
		let arr = this.getArray()
		keyValues.forEach(keyValue => {
			if (arr.length > keyValue.index) {
				arr[keyValue.index] = keyValue.value
			}
		})
		return new Array__(arr)
	}

    /**s
     * 
     * @param items 
     */
	append(items: TValue[]): Array__<TValue> {
		const newArray = this.getArray().concat(items)
		return new Array__<TValue>(newArray);
	}

	forEach(projector: Projector<TValue, void>) {
		for (let index = 0; index < this.length; index++) {
			projector((this as any)[index], index);
		}
	}
	map<TResult>(func: Projector<TValue, TResult>): Array__<TResult> {
		let _arr: TResult[] = new global.Array(this.length);
		this.forEach((item, index) => {
			_arr[index!] = func(item, index);
		})

		//console.log(`Collection map returning array of length ${_arr.length}`)
		return new Array__<TResult>(_arr);
	}
	reduce<TResult>(initial: TResult, reducer: Reducer<TValue, TResult>): TResult {
		let _value = initial; // initial parameter is required
		this.forEach((item, index) => {
			_value = reducer(_value, item, index);
		})

		return _value;
	}
	join<TResult>(separator: string): string {
		return (this.length === 0) ? "" : this.skip(1)
			.reduce(this.get(0)!.toString(), (prev, curr) => prev.toString() + separator + curr.toString())

	}

	filter(func: Predicate<TValue>): Array__<TValue> {
		var arr: TValue[] = [];
		this.forEach((item, index) => {
			if (func(item, index) === true)
				arr.push(item);
		})

		return new Array__<TValue>(arr);
	}

	/**
	 * Returns new array containing this array's elements in reverse order.
	 */
	reverse(): Array__<TValue> {
		return Array__.fromIterable(this.getArray().reverse());
	}

	firstOrDefault(func?: Predicate<TValue>): TValue | undefined {
		for (let index = 0; index < this.length; index++)
			if (func ? func((this as any)[index], index) === true : (this as any)[index] !== undefined)
				return (this as any)[index];

		return undefined;
	}
	first(func?: Predicate<TValue>): TValue {
		let firstOrDefault = this.firstOrDefault(func);
		if (firstOrDefault === undefined)
			throw new Error("First item not found");
		else
			return firstOrDefault;
	}
	lastOrDefault(func?: Predicate<TValue>): TValue | undefined {
		for (let index = (this.length - 1); index >= 0; index--)
			if (func ? func(this[index], index) === true : this[index] !== undefined)
				return this[index];

		return undefined;
	}
	last(func?: Predicate<TValue>): TValue {
		let lastOrDefault = this.lastOrDefault(func);
		if (lastOrDefault === undefined)
			throw new Error("Last item not found");
		else
			return lastOrDefault;
	}

	every(predicate: Predicate<TValue>): boolean {
		return this.count(predicate) === this.length;
	}
	some(predicate?: Predicate<TValue>): boolean {
		return this.firstOrDefault(predicate) !== undefined;
	}

	take(count: number, fromEnd: boolean = false): Array__<TValue> {
		return fromEnd
			? Array__.fromIterable(this.getArray().slice(-count))
			: Array__.fromIterable(this.getArray().slice(0, count));
	}
	skip(count: number, fromEnd: boolean = false): Array__<TValue> {
		return fromEnd
			? Array__.fromIterable(this.getArray().slice(0, -count))
			: Array__.fromIterable(this.getArray().slice(count));
	}

	/**
	 * Counts truthy mapped values in this array 
	 * This takes more time, but can be more useful than, just getting the length property
	 * @param func Optional mapper applied to each element before counting
	 */
	count(mapper?: Projector<TValue, any>): number {
		var count = 0;
		this.forEach((item, index) => {
			if (mapper ? mapper(item, index) : item as any)
				count++
		})

		return count;
	}
	sum(func?: Projector<TValue, number>): number {
		var sum = 0;
		this.forEach((item, index) => {
			sum += (func ? func(item, index) : item as any);
		})

		return sum;
	}
	average(projector?: Projector<TValue, number>): number | undefined {
		let sum = 0;
		let count = 0;
		this.forEach((item, index) => {
			let _value = projector ? projector(item, index) : item;
			if (typeof item === "number") {
				sum += _value as number;
				count++;
			}
		})

		if (count > 0)
			return sum / count;
		else
			return undefined
	}
	averageExcluding(mean: number, valueToExclude: number) {
		return (mean - (1.0 * valueToExclude / this.length)) * (1.0 * this.length / (this.length - 1));
	}

	variance(projector?: Projector<TValue, number>, mean?: number): number | undefined {
		if (this.length === 0) return undefined

		let numbers = this.getNumbers(projector)
		if (numbers.length === 0) return undefined
		if (numbers.length === 1) return 0

		let _mean = mean || numbers.average()!
		return numbers.map(datum => Math.pow(datum - _mean, 2)).sum() / (numbers.length - 1)
	}

	deviation(projector?: Projector<TValue, number>): number | undefined {
		let variance = this.variance(projector)
		return (variance !== undefined)
			? Math.sqrt(variance)
			: undefined
	}
	deviationExcluding(deviation: number, valueToExclude: number): number {
		let mean = this.averageExcluding(this.average()!, valueToExclude)
		return Math.sqrt(this.variance(undefined, mean)!)
	}

	frequency(item: TValue): number {
		return this.count(_item => _item === item);
	}

	removeItems(
		comparisonProjector: Projector<TValue, Primitive>,
		...itemsToRemove: TValue[]): Array__<TValue> {

		let itemsToRemoveMapped = itemsToRemove.map(comparisonProjector);
		return this.filter(item => !itemsToRemoveMapped.includes(comparisonProjector(item)));
	}
	removeIndices(indices: number[]): Array__<TValue> {
		return this.filter((item, index) => !indices.includes(index!));
	}
	removeSliceCounted(index: number, count: number): Array__<TValue> {
		return Array__.fromIterable([...this.getArray()].splice(index, count));
	}
	removeSliceDelimited(fromIndex: number, toIndex: number): Array__<TValue> {
		let arr = this.getArray();
		arr.splice(fromIndex, toIndex - fromIndex + 1)
		return new Array__(arr)
	}
	removeRange(from: TValue, to: TValue, mapper: Projector<TValue, Primitive>): Array__<TValue> {
		throw new Error("removeRange() invalid operation on a general array");
	}
	insert(index: number, ...items: TValue[]): Array__<TValue> {
		let arr = this.getArray()
		return Array__.fromIterable([...arr.slice(0, index), ...items, ...arr.slice(index)]);
	}

	/**
	 * Determines whether an array includes a certain element, returning true or false as appropriate.
	 * @param searchElement The element to search for.
	 * @param fromIndex The position in this array at which to begin searching for searchElement.
	 */
	contains(obj: TValue, fromIndex?: number): boolean {
		return ([...this.getArray()].indexOf(obj, fromIndex) >= 0)
	}

    /**
     * 
     * @param func Returns the index of the first element that meets a condition (or )
     * @param fromIndex 
     */
	indexOfFirst(predicate?: Predicate<TValue>, fromIndex?: number): number {
		for (let index = fromIndex || 0; index < this.length; index++)
			if (predicate ? predicate(this[index], index) : this[index] !== undefined)
				return index;

		return -1;
	}
}