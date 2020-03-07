(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.elt = {}));
}(this, (function (exports) { 'use strict';

    /**
     * Does a naive foreach on an IndexableArray
     * @param _arr the array
     * @param fn the function to apply
     */
    function EACH(_arr, fn) {
        for (var i = 0, arr = _arr.arr; i < arr.length; i++) {
            var item = arr[i];
            if (item == null)
                continue;
            fn(item);
        }
        _arr.actualize();
    }
    /**
     * An array wrapper that infects its elements with their indexes for faster deletion.
     */
    class IndexableArray {
        constructor() {
            this.arr = [];
            this.real_size = 0;
        }
        add(a) {
            const arr = this.arr;
            if (a.idx != null) {
                // will be put to the end
                arr[a.idx] = null;
            }
            else {
                this.real_size++;
            }
            a.idx = arr.length;
            arr.push(a);
        }
        actualize() {
            const arr = this.arr;
            if (this.real_size !== arr.length) {
                var newarr = new Array(this.real_size);
                for (var i = 0, j = 0, l = arr.length; i < l; i++) {
                    var item = arr[i];
                    if (item == null)
                        continue;
                    newarr[j] = item;
                    item.idx = j;
                    j++;
                }
                this.arr = newarr;
            }
        }
        delete(a) {
            if (a.idx != null) {
                this.arr[a.idx] = null;
                a.idx = null;
                this.real_size--;
            }
        }
        clear() {
            const a = this.arr;
            for (var i = 0; i < a.length; i++) {
                var item = a[i];
                if (item == null)
                    continue;
                item.idx = null;
            }
            this.arr = [];
            this.real_size = 0;
        }
    }

    /**
     * Make sure we have a usable observable.
     * @returns The original observable if `arg` already was one, or a new
     *   Observable holding the value of `arg` if it wasn't.
     * @category observable, toc
     */
    function o(arg) {
        return arg instanceof o.Observable ? arg : new o.Observable(arg);
    }
    (function (o_1) {
        /**
         * This class represents "no value", which is how Observers, Changes and Observable can
         * identify when a value changes from not existing to having a value.
         *
         * Think of it as a kind of `undefined`, which we couldn't use since `undefined` has a meaning and
         * is widely used.
         *
         * See `#o.NOVALUE`
         *
         * @category observable, toc
         */
        class NoValue {
            constructor() { }
        }
        o_1.NoValue = NoValue;
        /**
         * The only instance of the `NoValue` class.
         *
         * > **note**: the NoValue system is still pretty "hacky" in terms of typings, as its use is so far
         * > limited to implementing virtual observables that have readonly values or internally when checking
         * > if `Observer`s should be called. This will be made better in future releases.
         *
         */
        o_1.NOVALUE = new NoValue();
        function isReadonlyObservable(_) {
            return _ instanceof Observable;
        }
        o_1.isReadonlyObservable = isReadonlyObservable;
        /**
         * A helper class to deal with changes from an old `#o.Observable` value to a new one.
         * @category observable, toc
         */
        class Changes {
            constructor(n, o = o_1.NOVALUE) {
                this.n = n;
                this.o = o;
            }
            /**
             * Return true if the object changed compared to its previous value.
             * If there was no previous value, return true
             *
             *  changes, the function will return true.
             */
            changed(...ex) {
                const old = this.o;
                const n = this.n;
                if (old === o_1.NOVALUE)
                    return true;
                if (ex.length > 0) {
                    for (var e of ex) {
                        if (e(n) !== e(old))
                            return true;
                    }
                    return false;
                }
                return true;
            }
            /**
             * Does the same as changed, except that if there was no previous value,
             * return false.
             *
             *  undefined, it means that there was no previous value.
             */
            updated(...ex) {
                const old = this.o;
                const n = this.n;
                if (old === o_1.NOVALUE)
                    return false;
                if (ex.length > 0) {
                    for (var e of ex) {
                        const _o = e(old);
                        // we have an update only if there was an old value different
                        // from our current value that was not undefined.
                        if (_o !== undefined && e(n) !== _o)
                            return true;
                    }
                    return false;
                }
                return old !== n;
            }
            hasOldValue() {
                return this.o !== o_1.NOVALUE;
            }
            oldValue(def) {
                if (this.o === o_1.NOVALUE) {
                    if (arguments.length === 0)
                        throw new Error('there is no old value');
                    return def;
                }
                return this.o;
            }
        }
        o_1.Changes = Changes;
        /**
         * @category observable, toc
         */
        class Observer {
            constructor(fn, observable) {
                this.observable = observable;
                this.old_value = o_1.NOVALUE;
                this.idx = null;
                this.fn = fn;
            }
            refresh() {
                const old = this.old_value;
                const new_value = this.observable.__value;
                if (old !== new_value) {
                    // only store the old_value if the observer will need it. Useful to not keep
                    // useless references in memory.
                    this.old_value = new_value;
                    this.fn(new_value, new Changes(new_value, old));
                }
            }
            startObserving() {
                this.observable.addObserver(this);
            }
            stopObserving() {
                this.observable.removeObserver(this);
            }
            debounce(ms, leading) {
                this.refresh = o.debounce(this.refresh.bind(this), ms, leading);
                return this;
            }
            throttle(ms, leading) {
                this.refresh = o.throttle(this.refresh.bind(this), ms, leading);
                return this;
            }
        }
        o_1.Observer = Observer;
        /** @category internal */
        function each_recursive(obs, fn) {
            var objs = [];
            var stack = [];
            var [children, i] = [obs.__children.arr, 0];
            objs.push(obs);
            while (true) {
                var _child = children[i];
                if (_child) {
                    var child = _child.child;
                    var subchildren = child.__children.arr;
                    objs.push(child);
                    if (subchildren.length) {
                        stack.push([children, i + 1]);
                        children = subchildren;
                        i = 0;
                        continue;
                    }
                }
                i++;
                if (i > children.length) {
                    if (stack.length === 0)
                        break;
                    [children, i] = stack.pop();
                    continue;
                }
            }
            for (var i = 0, l = objs.length; i < l; i++) {
                fn(objs[i]);
            }
        }
        o_1.each_recursive = each_recursive;
        /** @category internal */
        class Queue extends IndexableArray {
            constructor() {
                super(...arguments);
                this.transaction_count = 0;
            }
            schedule(obs) {
                const was_empty = this.real_size === 0;
                each_recursive(obs, ob => {
                    this.add(ob);
                });
                if (this.transaction_count === 0 && was_empty) {
                    this.flush();
                }
            }
            unschedule(obs) {
                each_recursive(obs, ob => this.delete(ob));
            }
            transaction(fn) {
                this.transaction_count++;
                fn();
                this.transaction_count--;
                if (this.transaction_count === 0) {
                    this.flush();
                }
            }
            flush() {
                for (var i = 0, arr = this.arr; i < arr.length; i++) {
                    var obs = arr[i];
                    if (obs == null)
                        continue;
                    if (obs instanceof VirtualObservable) {
                        obs.__value = obs.getter(obs.__parents_values);
                    }
                    EACH(obs.__children, ch => {
                        ch.child.__parents_values[ch.child_idx] = ch.parent.__value;
                    });
                    EACH(obs.__observers, o => o.refresh());
                    obs.idx = null;
                    arr[i] = null; // just in case...
                }
                this.real_size = 0;
                // this.arr = []
                this.arr.length = 0;
                this.transaction_count = 0;
            }
        }
        o_1.Queue = Queue;
        /** @category internal */
        const queue = new Queue();
        /**
         * Start an observable transaction, where the observers of all the observables being
         * set or assigned to during the callback are only called at the end.
         *
         * Use it when you know you will modify two or more observables that trigger the same transforms
         * to avoid calling the observers each time one of the observable is modified.
         *
         * ```tsx
         * const o_1 = o(1)
         * const o_2 = o(2)
         * const o_3 = o.join(o_1, o_2).tf(([a, b]) => a + b)
         *
         * // ...
         *
         * // the observers on o_3 will only get called once instead of twice.
         * o.transaction(() => {
         *   o_1.set(2)
         *   o_2.set(3)
         * })
         * ```
         *
         * @category observable, toc
         */
        function transaction(fn) {
            queue.transaction(fn);
        }
        o_1.transaction = transaction;
        class ChildObservableLink {
            constructor(parent, child, child_idx) {
                this.parent = parent;
                this.child = child;
                this.child_idx = child_idx;
                this.idx = null;
            }
            refresh() {
                this.child.__parents_values[this.child_idx] = this.parent.__value;
            }
        }
        o_1.ChildObservableLink = ChildObservableLink;
        /**
         * The "writable" version of an Observable, counter-part to the `#o.ReadonlyObservable`.
         *
         * Comes with the `.set()` and `.assign()` methods.
         *
         * @category observable, toc
         */
        class Observable {
            /**
             * Build an observable from a value. For readability purposes, use the [`o()`](#o) function instead.
             */
            constructor(__value) {
                this.__value = __value;
                /** @category internal */
                this.__observers = new IndexableArray();
                /** @category internal */
                this.__children = new IndexableArray();
                /** @category internal */
                this.__watched = false;
                /** The index of this Observable in the notify queue. If null, means that it's not scheduled.
                 * @category internal
                */
                this.idx = null;
                // (this as any).debug = new Error
            }
            /**
             * Stop this Observable from observing other observables and stop
             * all observers currently watching this Observable.
             */
            stopObservers() {
                each_recursive(this, ob => {
                    if (ob.idx)
                        queue.delete(ob);
                    ob.__observers.clear();
                    if (ob.__watched) {
                        ob.__watched = false;
                        ob.unwatched();
                    }
                    ob.__children.clear();
                });
            }
            /**
             * Return the underlying value of this Observable
             *
             * NOTE: treat this value as being entirely readonly !
             */
            get() {
                return this.__value;
            }
            /**
             * Set the value of the observable and notify the observers listening
             * to this object of this new value.
             */
            set(value) {
                const old = this.__value;
                this.__value = value;
                if (old !== value)
                    queue.schedule(this);
            }
            /**
             * Expects a `fn` callback that takes the current value as a parameter and returns a new value.
             * It is the responsability of the caller to ensure the object is properly cloned before being modified.
             */
            mutate(fn) {
                this.set(fn(this.__value));
            }
            assign(partial) {
                this.set(o.assign(this.get(), partial));
            }
            /**
             * Create an observer bound to this observable, but do not start it.
             * For it to start observing, one needs to call its `startObserving()` method.
             *
             * > **Note**: This method should rarely be used. Prefer using [`$observe()`](#$observe), [`node_observe()`](#node_observe) or [`Mixin.observe`](#Mixin) for observing values.
             */
            createObserver(fn) {
                return new Observer(fn, this);
            }
            addObserver(_ob) {
                if (typeof _ob === 'function') {
                    _ob = this.createObserver(_ob);
                }
                const ob = _ob;
                this.__observers.add(_ob);
                this.checkWatch();
                if (this.idx == null)
                    ob.refresh();
                return ob;
            }
            /**
             * Add a child observable to this observable that will depend on it to build its own value.
             * @category internal
             */
            addChild(ch) {
                if (ch.idx != null)
                    return;
                this.__children.add(ch);
                if (this.idx != null)
                    queue.add(ch.child);
                this.checkWatch();
            }
            /**
             * @category internal
             */
            removeChild(ch) {
                if (ch.idx == null)
                    return;
                this.__children.delete(ch);
                this.checkWatch();
            }
            /**
             * Remove an observer from this observable. This means the Observer will not
             * be called anymore when this Observable changes.
             *
             * If there are no more observers watching this Observable, then it will stop
             * watching other Observables in turn if it did.
             *
             */
            removeObserver(ob) {
                this.__observers.delete(ob);
                this.checkWatch();
            }
            /**
             * Check if this `Observable` is being watched or not. If it stopped being observed but is in the notification
             * queue, remove it from there as no one is expecting its value.
             *
             * @category internal
             */
            checkWatch() {
                if (this.__watched && this.__observers.real_size === 0 && this.__children.real_size === 0) {
                    this.__watched = false;
                    if (this.idx != null)
                        queue.delete(this);
                    this.unwatched();
                }
                else if (!this.__watched && this.__observers.real_size + this.__children.real_size > 0) {
                    this.__watched = true;
                    this.watched();
                }
            }
            /**
             * @category internal
             */
            unwatched() { }
            /**
             * @category internal
             */
            watched() { }
            tf(fnget) {
                var old = o_1.NOVALUE;
                var old_fnget = o_1.NOVALUE;
                var curval = o_1.NOVALUE;
                return combine([this, fnget], ([v, fnget]) => {
                    if (isValue(old) && isValue(old_fnget) && old === v && old_fnget === fnget && isValue(curval))
                        return curval;
                    curval = (typeof fnget === 'function' ? fnget(v, old, curval) : fnget.get(v, old, curval));
                    old = v;
                    old_fnget = fnget;
                    return curval;
                }, (newv, old, [curr, conv]) => {
                    if (typeof conv === 'function')
                        return;
                    var new_orig = conv.set(newv, old, curr);
                    return [new_orig, o.NOVALUE];
                });
            }
            /**
             * Create an observable that will hold the value of the property specified with `key`.
             * The resulting observable is completely bi-directional.
             *
             * The `key` can itself be an observable, in which case the resulting observable will
             * change whenever either `key` or the original observable change.
             *
             * ```tsx
             * const o_base = o({a: 1, b: 2}) // Observable<{a: number, b: number}>
             * const o_base_a = o_base.p('a') // Observable<number>
             * o_base_a.set(4) // o_base now holds {a: 4, b: 2}
             *
             * const o_key = o('b' as 'b' | 'a') // more generally `keyof T`
             * const o_tf_key = o_base.p(o_key) // 2
             * o_key.set('a') // o_tf_key now has 4
             *
             * const o_base_2 = o([1, 2, 3, 4]) // Observable<number[]>
             * const o_base_2_item = o_base_2.p(2) // Observable<number>
             * ```
             */
            p(key) {
                return prop(this, key);
            }
        }
        o_1.Observable = Observable;
        /**
         * An observable that does not its own value, but that depends
         * from outside getters and setters. The `#o.virtual` helper makes creating them easier.
         *
         * @category observable, internal
         */
        class VirtualObservable extends Observable {
            constructor(deps) {
                super(o_1.NOVALUE);
                /** @category internal */
                this.__links = [];
                /** @category internal */
                this.__parents_values = [];
                this.dependsOn(deps);
            }
            getter(values) {
                return values.slice();
            }
            setter(nval, oval, last) {
                return nval; // by default, just forward the type
            }
            watched() {
                const p = this.__parents_values;
                for (var i = 0, l = this.__links; i < l.length; i++) {
                    var link = l[i];
                    link.parent.addChild(link);
                    p[link.child_idx] = link.parent.__value;
                }
                this.__value = this.getter(p);
            }
            unwatched() {
                for (var i = 0, l = this.__links; i < l.length; i++) {
                    var link = l[i];
                    link.parent.removeChild(link);
                }
            }
            refreshParentValues() {
                var changed = false;
                for (var i = 0, l = this.__links, p = this.__parents_values; i < l.length; i++) {
                    var link = l[i];
                    var idx = link.child_idx;
                    var old = p[idx];
                    var n = link.parent.get();
                    if (old !== n) {
                        changed = true;
                        p[idx] = n;
                    }
                }
                return changed;
            }
            get() {
                if (!this.__watched) {
                    if (this.refreshParentValues() || this.__value === o_1.NOVALUE) {
                        this.__value = this.getter(this.__parents_values);
                    }
                }
                return this.__value;
            }
            set(value) {
                // Do not trigger the set chain if the value did not change.
                if (!this.__watched)
                    this.__value = this.getter(this.__parents_values);
                if (value === this.__value)
                    return;
                const old_value = this.__value;
                if (!this.__watched)
                    this.refreshParentValues();
                const res = this.setter(value, old_value, this.__parents_values);
                if (res == undefined)
                    return;
                for (var i = 0, l = this.__links, len = l.length; i < len; i++) {
                    var link = l[i];
                    var newval = res[link.child_idx];
                    if (newval !== o_1.NOVALUE && newval !== link.parent.__value) {
                        link.parent.set(newval);
                    }
                }
            }
            dependsOn(obs) {
                var p = new Array(obs.length);
                var ch = [];
                for (var l = obs.length, i = 0; i < l; i++) {
                    var ob = obs[i];
                    if (ob instanceof Observable) {
                        p[i] = ob.__value;
                        ch.push(new ChildObservableLink(ob, this, ch.length));
                    }
                    else {
                        p[i] = ob;
                    }
                }
                this.__links = ch;
                this.__parents_values = p;
                return this;
            }
        }
        o_1.VirtualObservable = VirtualObservable;
        function combine(deps, get, set) {
            var virt = new VirtualObservable(deps);
            virt.getter = get;
            virt.setter = set; // force undefined to trigger errors for readonly observables.
            return virt;
        }
        o_1.combine = combine;
        function merge(obj) {
            const keys = Object.keys(obj);
            const parents = keys.map(k => obj[k]);
            return combine(parents, args => {
                var res = {};
                for (var i = 0; i < keys.length; i++) {
                    res[keys[i]] = args[i];
                }
                return res;
            }, back => keys.map(k => back[k]));
        }
        o_1.merge = merge;
        /**
         * @category observable, toc
         */
        function prop(obj, prop) {
            return combine([obj, prop], ([obj, prop]) => obj[prop], (nval, _, [orig, prop]) => {
                const newo = o.clone(orig);
                newo[prop] = nval;
                return o.tuple(newo, o.NOVALUE);
            });
        }
        o_1.prop = prop;
        function get(arg) {
            return arg instanceof Observable ? arg.get() : arg;
        }
        o_1.get = get;
        /**
         * Do a transform of the provided argument and return a tranformed observable
         * only if it was itself observable.
         * This function is meant to be used when building components to avoid creating
         * Observable objects for values that were not.
         * @category observable, toc
         */
        function tf(arg, fn) {
            if (arg instanceof Observable) {
                if (typeof fn === 'function') {
                    return arg.tf(fn);
                }
                else
                    return arg.tf(fn);
            }
            else {
                if (typeof fn === 'function')
                    return fn(arg, o_1.NOVALUE, o_1.NOVALUE);
                else
                    return fn.get(arg, o_1.NOVALUE, o_1.NOVALUE);
            }
        }
        o_1.tf = tf;
        function p(mobs, key) {
            if (mobs instanceof Observable) {
                return mobs.p(key);
            }
            else {
                return mobs[key];
            }
        }
        o_1.p = p;
        /**
         * Combine several MaybeObservables into an Observable<boolean>
         * @returns A boolean Observable that is true when all of them are true, false
         *   otherwise.
         * @category observable, toc
         */
        function and(...args) {
            return combine(args, (args) => {
                for (var i = 0, l = args.length; i < l; i++) {
                    if (!args[i])
                        return false;
                }
                return true;
            });
        }
        o_1.and = and;
        /**
         * Combine several MaybeObservables into an Observable<boolean>
         * @returns A boolean Observable that is true when any of them is true, false
         *   otherwise.
         * @category observable, toc
         */
        function or(...args) {
            return combine(args, (args) => {
                for (var i = 0, l = args.length; i < l; i++) {
                    if (args[i])
                        return true;
                }
                return false;
            });
        }
        o_1.or = or;
        function join(...deps) {
            return new VirtualObservable(deps);
        }
        o_1.join = join;
        function assign(value, mutator) {
            if (mutator == null || typeof mutator !== 'object' || Object.getPrototypeOf(mutator) !== Object.prototype)
                return mutator;
            if (typeof mutator === 'object') {
                var clone = o.clone(value) || {}; // shallow clone
                var changed = false;
                for (var name in mutator) {
                    var old_value = clone[name];
                    var new_value = assign(clone[name], mutator[name]);
                    changed = changed || old_value !== new_value;
                    clone[name] = new_value;
                }
                if (!changed)
                    return value;
                return clone;
            }
            else {
                return value;
            }
        }
        o_1.assign = assign;
        function debounce(fn, ms, leading = false) {
            var timer;
            var prev_res;
            var lead = false;
            // Called as a method decorator.
            if (arguments.length === 1) {
                leading = ms;
                ms = fn;
                return function (target, key, desc) {
                    var original = desc.value;
                    desc.value = debounce(original, ms);
                };
            }
            return function (...args) {
                if (leading && !lead && !timer) {
                    prev_res = fn.apply(this, args);
                    lead = true;
                }
                if (timer) {
                    lead = false;
                    clearTimeout(timer);
                }
                timer = window.setTimeout(() => {
                    if (!lead) {
                        prev_res = fn.apply(this, args);
                    }
                    lead = false;
                }, ms);
                return prev_res;
            };
        }
        o_1.debounce = debounce;
        function throttle(fn, ms, leading = false) {
            // Called as a method decorator.
            if (typeof fn === 'number') {
                leading = ms;
                ms = fn;
                return function (target, key, desc) {
                    var original = desc.value;
                    desc.value = throttle(original, ms, leading);
                };
            }
            var timer;
            var prev_res;
            var last_call = 0;
            var _args;
            var self;
            return function (...args) {
                var now = Date.now();
                // If the delay expired or if this is the first time this function is called,
                // then trigger the call. Otherwise, we will have to set up the call.
                if ((leading && last_call === 0) || last_call + ms <= now) {
                    prev_res = fn.apply(this, args);
                    last_call = now;
                    return prev_res;
                }
                self = this;
                _args = args;
                if (!timer) {
                    timer = window.setTimeout(function () {
                        prev_res = fn.apply(self, _args);
                        last_call = Date.now();
                        _args = null;
                        timer = null;
                    }, ms - (now - (last_call || now)));
                }
                return prev_res;
            };
        }
        o_1.throttle = throttle;
        o_1.clone_symbol = Symbol('o.clone_symbol');
        /**
         * @category observable, toc
         */
        function isNoValue(t) {
            return t === o_1.NOVALUE;
        }
        o_1.isNoValue = isNoValue;
        /**
         * @category observable, toc
         */
        function isValue(t) {
            return t !== o_1.NOVALUE;
        }
        o_1.isValue = isValue;
        /**
         * Returns its arguments as an array but typed as a tuple from Typescript's point of view.
         *
         * This only exists because there is no way to declare a tuple in Typescript other than with a plain
         * array, and arrays with several types end up as an union.
         *
         * ```tsx
         * var a = ['hello', 2] // a is (string | number)[]
         * var b = o.tuple('hello', 2) // b is [string, number]
         * ```
         *
         * @category observable, toc
         */
        function tuple(...t) {
            return t;
        }
        o_1.tuple = tuple;
        function clone(obj) {
            if (obj == null || typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean')
                return obj;
            var clone;
            var len;
            var key;
            if (obj[o_1.clone_symbol]) {
                return obj[o_1.clone_symbol]();
            }
            if (Array.isArray(obj)) {
                len = obj.length;
                clone = new Array(len);
                for (key = 0; key < len; key++)
                    clone[key] = obj[key];
                return clone;
            }
            if (obj instanceof Date) {
                return new Date(obj.getTime()); // timezone ?
            }
            if (obj instanceof RegExp) {
                return new RegExp(obj.source, ''
                    + obj.global ? 'g' : ''
                    + obj.multiline ? 'm' : ''
                    + obj.unicode ? 'u' : ''
                    + obj.ignoreCase ? 'i' : ''
                    + obj.sticky ? 'y' : '');
            }
            if (obj instanceof Map) {
                clone = new Map();
                obj.forEach((key, value) => {
                    clone.set(key, value);
                });
                return clone;
            }
            if (obj instanceof Set) {
                clone = new Set();
                obj.forEach(val => clone.add(val));
                return clone;
            }
            // If we got here, then we're cloning an object
            var prototype = Object.getPrototypeOf(obj);
            clone = Object.create(prototype);
            for (key of Object.getOwnPropertyNames(obj)) {
                // should we check for writability ? enumerability ?
                if (obj.propertyIsEnumerable(key))
                    clone[key] = obj[key];
            }
            for (var sym of Object.getOwnPropertySymbols(obj)) {
                if (obj.propertyIsEnumerable(sym))
                    clone[sym] = obj[sym];
            }
            return clone;
        }
        o_1.clone = clone;
        /**
         * Returns a function that accepts a callback. While this callback is running, all calls
         * to the returned locks will not launch.
         *
         * This helper is to be used when have observables which set each other's value in observers,
         * which could end up in an infinite loop.
         *
         * @returns a function that accepts a callback
         * @category observable, toc
         */
        function exclusive_lock() {
            var locked = false;
            return function exclusive_lock(fn) {
                if (locked)
                    return;
                locked = true;
                fn();
                locked = false;
            };
        }
        o_1.exclusive_lock = exclusive_lock;
        /**
         * A group of observers that can be started and stopped at the same time.
         * This class is meant to be used for components such as Mixin that want
         * to tie observing to their life cycle.
         * @category observable, toc
         */
        class ObserverHolder {
            constructor() {
                this.observers = [];
                this.live = false;
            }
            startObservers() {
                for (var ob of this.observers)
                    ob.startObserving();
                this.live = true;
            }
            stopObservers() {
                for (var ob of this.observers)
                    ob.stopObserving();
                this.live = false;
            }
            /**
             * Observe and Observable and return the observer that was created
             */
            observe(obs, fn) {
                if (!(obs instanceof Observable)) {
                    fn(obs, new Changes(obs));
                    return null;
                }
                const observer = o(obs).createObserver(fn);
                return this.addObserver(observer);
            }
            /**
             * Add an observer to the observers array
             */
            addObserver(observer) {
                this.observers.push(observer);
                if (this.live)
                    observer.startObserving();
                return observer;
            }
            /**
             * Remove the observer from this group
             */
            remove(observer) {
                const idx = this.observers.indexOf(observer);
                if (idx > -1) {
                    if (this.live)
                        observer.stopObserving();
                    this.observers.splice(idx, 1);
                }
            }
        }
        o_1.ObserverHolder = ObserverHolder;
    })(o || (o = {}));

    (function (tf) {
        /**
         * @category observable, toc
         */
        function equals(other) {
            return o.tf(other, oth => (current) => current === oth);
        }
        tf.equals = equals;
        /**
         * @category observable, toc
         */
        function differs(other) {
            return o.tf(other, oth => (current) => current !== oth);
        }
        tf.differs = differs;
        /**
         * @category observable, toc
         */
        function is_truthy(val) { return !!val; }
        tf.is_truthy = is_truthy;
        /**
         * @category observable, toc
         */
        function is_falsy(val) { return !val; }
        tf.is_falsy = is_falsy;
        /**
         * @category observable, toc
         */
        function is_value(val) { return val != null; }
        tf.is_value = is_value;
        /**
         * @category observable, toc
         */
        function is_not_value(val) { return val == null; }
        tf.is_not_value = is_not_value;
        /**
         * @category observable, toc
         */
        function array_transform(fn) {
            return o.tf(fn, fn => {
                return {
                    indices: [],
                    get(list) {
                        if (Array.isArray(fn))
                            this.indices = fn;
                        else
                            this.indices = fn(list);
                        return this.indices.map(i => list[i]);
                    },
                    set(newval, _, current) {
                        var res = current.slice();
                        for (var i = 0, idx = this.indices; i < idx.length; i++) {
                            res[idx[i]] = newval[i];
                        }
                        return res;
                    }
                };
            });
        }
        tf.array_transform = array_transform;
        /**
         * Filter an array.
         *
         * @param condition The condition the item has to pass to be kept
         * @param stable If false, the array is refiltered for any change in the condition or array.
         *    If true, only refilter if the condition changes, but keep the indices even if the array changes.
         * @category observable, toc
         */
        function array_filter(condition, stable = false) {
            return o.combine(o.tuple(condition, stable), ([cond, stable]) => {
                return {
                    indices: [],
                    get(lst, old_val) {
                        var indices = stable && o.isValue(old_val) ? this.indices : [];
                        // If the filter is stable, then start adding values at the end if the array changed length
                        var start = stable && o.isValue(old_val) ? old_val.length : 0;
                        // this will only run if the old length is smaller than the new length.
                        for (var i = start, l = lst.length; i < l; i++) {
                            if (cond(lst[i], i, lst))
                                indices.push(i);
                        }
                        // if the array lost elements, then we have to remove those indices that are no longer relevant.
                        // fortunately, this.indices is sorted and we just have to go back from the beginning.
                        if (start > lst.length) {
                            for (i = indices.length - 1; indices[i] >= lst.length && i >= 0; i--) { }
                            indices = i < 0 ? [] : indices.slice(0, i + 1);
                        }
                        this.indices = indices;
                        return indices.map(i => lst[i]);
                    },
                    set(newval, _, current) {
                        var res = current.slice();
                        for (var i = 0, idx = this.indices; i < idx.length; i++) {
                            res[idx[i]] = newval[i];
                        }
                        return res;
                    }
                };
            });
        }
        tf.array_filter = array_filter;
        /**
         * Transforms an array by sorting it. The sort function must return 0 in case of equality.
         * @param sortfn
         * @category observable, toc
         */
        function sort(sortfn) {
            return array_transform(o.tf(sortfn, sortfn => (lst) => {
                var res = new Array(lst.length);
                for (var i = 0, l = lst.length; i < l; i++)
                    res[i] = i;
                res.sort((a, b) => sortfn(lst[a], lst[b]));
                return res;
            }));
        }
        tf.sort = sort;
        /**
         * Sort an array by extractors, given in order of importance.
         * @param sorters
         * @category observable, toc
         */
        function sort_by(sorters) {
            return sort(o.tf(sorters, _sorters => {
                var sorters = [];
                var mult = [];
                for (var i = 0, l = _sorters.length; i < l; i++) {
                    var srt = _sorters[i];
                    if (Array.isArray(srt)) {
                        mult.push(srt[1] === 'desc' ? -1 : 1);
                        sorters.push(srt[0]);
                    }
                    else {
                        mult.push(1);
                        sorters.push(srt);
                    }
                }
                return (a, b) => {
                    for (var i = 0, l = sorters.length; i < l; i++) {
                        var _a = sorters[i](a);
                        var _b = sorters[i](b);
                        if (_a < _b)
                            return -1 * mult[i];
                        if (_a > _b)
                            return 1 * mult[i];
                    }
                    return 0;
                };
            }));
        }
        tf.sort_by = sort_by;
        /**
         * Group by an extractor function.
         * @category observable, toc
         */
        function group_by(extractor) {
            return o.tf(extractor, extractor => {
                return {
                    length: 0,
                    indices: [],
                    get(lst) {
                        var _c;
                        this.length = lst.length;
                        var m = new Map();
                        for (var i = 0, l = lst.length; i < l; i++) {
                            var item = lst[i];
                            var ex = extractor(item);
                            var ls = (_c = m.get(ex), (_c !== null && _c !== void 0 ? _c : m.set(ex, []).get(ex)));
                            ls.push(i);
                        }
                        var res = [];
                        for (var entry of m.entries()) {
                            var ind = entry[1];
                            var newl = new Array(ind.length);
                            for (var i = 0, l = ind.length; i < l; i++) {
                                newl[i] = lst[ind[i]];
                            }
                            res.push([entry[0], newl]);
                        }
                        return res;
                    },
                    set(nval) {
                        var res = new Array(this.length);
                        var ind = this.indices;
                        for (var i = 0, li = ind.length; i < li; i++) {
                            var line = ind[i];
                            for (var j = 0, lj = line.length; j < lj; j++) {
                                var nval_line = nval[i][1];
                                res[line[j]] = nval_line[j];
                            }
                        }
                        return res;
                    }
                };
            });
        }
        tf.group_by = group_by;
        /**
         * Object entries, as returned by Object.keys() and returned as an array of [key, value][]
         * @category observable, toc
         */
        function entries() {
            return {
                get(item) {
                    var res = [];
                    var keys = Object.keys(item);
                    for (var i = 0, l = keys.length; i < l; i++) {
                        var k = keys[i];
                        res.push([k, item[k]]);
                    }
                    return res;
                },
                set(nval) {
                    var nres = {};
                    for (var i = 0, l = nval.length; i < l; i++) {
                        var entry = nval[i];
                        nres[entry[0]] = entry[1];
                    }
                    return nres;
                }
            };
        }
        tf.entries = entries;
        /**
         * Object entries, as returned by Object.keys() and returned as an array of [key, value][]
         * @category observable, toc
         */
        function map_entries() {
            return {
                get(item) {
                    return [...item.entries()];
                },
                set(nval) {
                    var nres = new Map();
                    for (var i = 0, l = nval.length; i < l; i++) {
                        var entry = nval[i];
                        nres.set(entry[0], entry[1]);
                    }
                    return nres;
                }
            };
        }
        tf.map_entries = map_entries;
        /**
         *
         * @param values The values that should be in the set.
         * @category observable, toc
         */
        function set_has(...values) {
            return o.combine(values, (values) => {
                return {
                    get(set) {
                        for (var i = 0; i < values.length; i++) {
                            var item = values[i];
                            if (!set.has(item))
                                return false;
                        }
                        return true;
                    },
                    set(newv, _, set) {
                        const res = new Set(set);
                        for (var i = 0; i < values.length; i++) {
                            var item = values[i];
                            if (newv)
                                res.add(item);
                            else
                                res.delete(item);
                        }
                        return res;
                    }
                };
            });
        }
        tf.set_has = set_has;
    })(exports.tf || (exports.tf = {}));

    /**
     * Symbol property on `Node` to an array of observers that are started when the node is `init()` and
     * stopped on `deinit()`.
     * @internal
     */
    const sym_observers = Symbol('elt-observers');
    /**
     * Symbol property added on `Node` to track the status of the node ; if it's been init(), inserted() or more.
     * Its value type is `string`.
     * @internal
     */
    const sym_mount_status = Symbol('elt-mount-status');
    /**
     * This symbol is added as a property of the DOM nodes to store mixins associated with it.
     *
     * The more "correct" way of achieving this would have been to create
     * a WeakSet, but since the performance is not terrific (especially
     * when the number of elements gets high), the symbol solution was retained.
     * @internal
     */
    const sym_mixins = Symbol('elt-mixins');
    /**
     * A symbol property on `Node` to an array of functions to run when the node is **init**, which is to
     * say usually right when it was created but already added to a parent (which can be a `DocumentFragment`).
     * @internal
     */
    const sym_init = Symbol('elt-init');
    /**
     * A symbol property on `Node` to an array of functions to run when the node is **inserted** into a document.
     * @internal
     */
    const sym_inserted = Symbol('elt-inserted');
    /**
     * A symbol property on `Node` to an array of functions to run when the node is **removed** from a document.
     * @internal
     */
    const sym_removed = Symbol('elt-removed');
    const NODE_IS_INITED = 0x01;
    const NODE_IS_INSERTED = 0x10;
    const NODE_IS_OBSERVING = 0x100;
    function _node_call_cbks(node, sym, parent) {
        var cbks = node[sym];
        if (!cbks)
            return;
        parent = (parent !== null && parent !== void 0 ? parent : node.parentNode);
        for (var i = 0, l = cbks.length; i < l; i++) {
            cbks[i](node, parent);
        }
    }
    function _node_start_observers(node) {
        var obs = node[sym_observers];
        if (!obs)
            return;
        for (var i = 0, l = obs.length; i < l; i++) {
            obs[i].startObserving();
        }
    }
    function _node_stop_observers(node) {
        var obs = node[sym_observers];
        if (!obs)
            return;
        for (var i = 0, l = obs.length; i < l; i++) {
            obs[i].stopObserving();
        }
    }
    /**
     * Return `true` if this node is currently observing its associated observables.
     */
    function node_is_observing(node) {
        return !!(node[sym_mount_status] & NODE_IS_OBSERVING);
    }
    /**
     * Return `true` is the init() phase was already executed on this node.
     */
    function node_is_inited(node) {
        return !!(node[sym_mount_status] & NODE_IS_INITED);
    }
    /**
     * Return `true` if the node is *considered* inserted in the document.
     *
     * There can be a slight variation between the result of this function and `node.isConnected`, since
     * its status is potentially updated after the node was inserted or removed from the dom, or could
     * have been forced to another value by a third party.
     *
     * @category dom, toc
     */
    function node_is_inserted(node) {
        return !!(node[sym_mount_status] & NODE_IS_INSERTED);
    }
    /**
     * Call init() functions on a node, and start its observers.
     * @category internal
     */
    function node_do_init(node) {
        // if there is anything in the status, it means the node was inited before,
        // so we don't do that again.
        if (!(node[sym_mount_status] & NODE_IS_INITED))
            _node_call_cbks(node, sym_init);
        if (!(node[sym_mount_status] & NODE_IS_OBSERVING))
            // call init functions
            _node_start_observers(node);
        node[sym_mount_status] = NODE_IS_INITED | NODE_IS_OBSERVING;
    }
    function _apply_inserted(node) {
        var st = node[sym_mount_status] || 0;
        // init if it was not done
        if (!(st & NODE_IS_INITED))
            _node_call_cbks(node, sym_init);
        // restart observers
        if (!(st & NODE_IS_OBSERVING))
            _node_start_observers(node);
        // then, call inserted.
        if (!(st & NODE_IS_INSERTED)) {
            _node_call_cbks(node, sym_inserted);
        }
        node[sym_mount_status] = NODE_IS_INITED | NODE_IS_INSERTED | NODE_IS_OBSERVING; // now inserted
    }
    /**
     * @category internal
     */
    function node_do_inserted(node) {
        if (node[sym_mount_status] & NODE_IS_INSERTED)
            return;
        var iter = node.firstChild;
        var stack = [];
        // We build here a stack where parents are added first and children last
        _apply_inserted(node);
        while (iter) {
            // we ignore an entire subtree if the node is already marked as inserted
            // in all other cases, the node will be inserted
            if (!(iter[sym_mount_status] & NODE_IS_INSERTED)) {
                _apply_inserted(iter);
                var first = iter.firstChild;
                if (first) {
                    var next = iter.nextSibling; // where we'll pick up when we unstack.
                    if (next)
                        stack.push(next);
                    iter = first; // we will keep going to the children
                    continue;
                }
                else if (iter.nextSibling) {
                    iter = iter.nextSibling;
                    continue;
                }
            }
            iter = stack.pop();
        }
    }
    /**
     * Apply unmount to a node.
     * @internal
     */
    function _apply_removed(node, prev_parent) {
        var st = node[sym_mount_status];
        if (st & NODE_IS_OBSERVING) {
            _node_stop_observers(node);
            st = st ^ NODE_IS_OBSERVING;
        }
        if (prev_parent && st & NODE_IS_INSERTED) {
            _node_call_cbks(node, sym_removed);
            st = st ^ NODE_IS_INSERTED;
        }
        node[sym_mount_status] = st;
    }
    /**
     * Traverse the node tree of `node` and call the `deinit()` handlers, begininning by the leafs and ending
     * on the root.
     *
     * If `prev_parent` is not supplied, then the `remove` is not run, but observers stop.
     *
     * @category dom, toc
     */
    function node_do_remove(node, prev_parent) {
        const node_stack = [];
        var iter = node.firstChild;
        while (iter) {
            while (iter.firstChild) {
                node_stack.push(iter);
                iter = iter.firstChild;
            }
            _apply_removed(iter, prev_parent ? iter.parentNode : null);
            if (prev_parent)
                // When we're here, we're on a terminal node, so
                // we're going to have to process it.
                while (iter && !iter.nextSibling) {
                    iter = node_stack.pop();
                    if (iter)
                        _apply_removed(iter, prev_parent ? iter.parentNode : null);
                }
            // So now we're going to traverse the next node.
            iter = iter && iter.nextSibling;
        }
        _apply_removed(node, prev_parent);
    }
    /**
     * Remove a `node` from the tree and call `removed` on its mixins and all the `removed` callbacks..
     *
     * This function is mostly used by verbs that don't want to wait for the mutation observer
     * callback registered in [`setup_mutation_observer`](#setup_mutation_observer)
     *
     * @category low level dom, toc
     */
    function remove_and_deinit(node) {
        const parent = node.parentNode;
        if (parent) {
            // (m as any).node = null
            parent.removeChild(node);
            node_do_remove(node, parent);
        }
        else {
            node_do_remove(node, null); // just stop observers otherwise...
        }
    }
    /**
     * Setup the mutation observer that will be in charge of listening to document changes
     * so that the `init`, `inserted` and `removed` life-cycle callbacks are called.
     *
     * This should be the first thing done at the top level of a project using ELT.
     *
     * If the code opens another window, it **must** use `setup_mutation_observer` on the newly created
     * window's document or other `Node` that will hold the ELT application.
     *
     * This function also registers a listener on the `unload` event of the `document` or `ownerDocument`
     * to stop all the observers when the window closes.
     *
     * ```tsx
     * import { setup_mutation_observer, $inserted } from 'elt'
     * // typically in the top-level app.tsx or index.tsx
     * // setup_mutation_observer(document)
     *
     * // This example may require a popup permission from your browser.
     * const new_window = window.open(undefined, '_blank', 'menubar=0,status=0,toolbar=0')
     * if (new_window) {
     *   setup_mutation_observer(new_window.document)
     *   new_window.document.body.appendChild(<div>
     *     {$inserted(() => console.log('inserted.'))}
     *   </div>)
     * }
     *
     *
     * @category dom, toc
     */
    function setup_mutation_observer(node) {
        var _a;
        if (!node.isConnected && !!node.ownerDocument)
            throw new Error(`cannot setup mutation observer on a Node that is not connected in a document`);
        var obs = new MutationObserver(records => {
            for (var i = 0, l = records.length; i < l; i++) {
                var record = records[i];
                for (var added = Array.from(record.addedNodes), j = 0, lj = added.length; j < lj; j++) {
                    var added_node = added[j];
                    // skip this node if it is already marked as inserted, as it means verbs already
                    // have performed the mounting for this element
                    if (added_node[sym_mount_status] & NODE_IS_INSERTED) {
                        continue;
                    }
                    node_do_inserted(added_node);
                }
                for (var removed = Array.from(record.removedNodes), j = 0, lj = removed.length; j < lj; j++) {
                    var removed_node = removed[j];
                    node_do_remove(removed_node, record.target);
                }
            }
        });
        (_a = node.ownerDocument, (_a !== null && _a !== void 0 ? _a : node)).addEventListener('unload', ev => {
            node_do_remove(node, null); // technically, the nodes were not removed, but we want to at least shut down all observers.
            obs.disconnect();
        });
        // observe modifications to *all the tree*
        obs.observe(node, {
            childList: true,
            subtree: true
        });
        return obs;
    }
    /**
     * Insert a `node` to a `parent`'s child list before `refchild`.
     *
     * This method should **always** be used instead of `Node.appendChild` or `Node.insertBefore` when
     * dealing with nodes created with `#e`, as it performs the following operations on top of adding
     * them :
     *
     *  - Call the `init()` methods on `#Mixin`s present on the nodes that were not already mounted
     *  - Call the `inserted()` methods on `#Mixin`'s present on **all** the nodes and their descendents
     *     if `parent` is already inside the DOM.
     *
     * @category dom, toc
     */
    function insert_before_and_init(parent, node, refchild = null) {
        var df;
        if (!(node instanceof DocumentFragment)) {
            df = document.createDocumentFragment();
            df.appendChild(node);
        }
        else {
            df = node;
        }
        var iter = df.firstChild;
        while (iter) {
            node_do_init(iter);
            iter = iter.nextSibling;
        }
        var first = df.firstChild;
        var last = df.lastChild;
        parent.insertBefore(df, refchild);
        // If the parent was in the document, then we have to call inserted() on all the
        // nodes we're adding.
        if (parent.isConnected && first && last) {
            iter = last;
            // we do it in reverse because Display and the likes do it from previous to next.
            while (iter) {
                var next = iter.previousSibling;
                node_do_inserted(iter);
                if (iter === first)
                    break;
                iter = next;
            }
        }
    }
    /**
     * Alias for `#insert_before_and_mount` that mimicks `Node.appendChild()`
     * @category dom, toc
     */
    function append_child_and_init(parent, child) {
        insert_before_and_init(parent, child);
    }
    /**
     * Tie the observal of an `#Observable` to the presence of this node in the DOM.
     *
     * Observers are called whenever the observable changes **and** the node is contained
     * in the document.
     *
     * @category dom, toc
     */
    function node_observe(node, obs, obsfn) {
        if (!(o.isReadonlyObservable(obs))) {
            obsfn(obs, new o.Changes(obs));
            return null;
        }
        // Create the observer and append it to the observer array of the node
        var obser = obs.createObserver(obsfn);
        if (node[sym_observers] == undefined)
            node[sym_observers] = [];
        node[sym_observers].push(obser);
        if (node[sym_mount_status] & NODE_IS_OBSERVING)
            obser.startObserving(); // this *may* be a problem ? FIXME TODO
        // we might need to track the mounting status of a node.
        return obser;
    }
    function node_add_event_listener(node, ev, listener) {
        if (Array.isArray(ev))
            for (var e of ev)
                node.addEventListener(e, listener);
        else {
            node.addEventListener(ev, listener);
        }
    }
    /**
     * Stop a node from observing an observable, even if it is still in the DOM
     * @category dom, toc
     */
    function node_unobserve(node, obsfn) {
        var _a;
        const is_observing = node[sym_mount_status] & NODE_IS_OBSERVING;
        node[sym_observers] = (_a = node[sym_observers]) === null || _a === void 0 ? void 0 : _a.filter(ob => {
            const res = ob === obsfn || ob.fn === obsfn;
            if (res && is_observing) {
                // stop the observer before removing it from the list if the node was observing
                ob.stopObserving();
            }
            return !res;
        });
    }
    /**
     * Observe an attribute and update the node as needed.
     * @category dom, toc
     */
    function node_observe_attribute(node, name, value) {
        node_observe(node, value, val => {
            if (val === true)
                node.setAttribute(name, '');
            else if (val != null && val !== false)
                node.setAttribute(name, val);
            else
                // We can remove safely even if it doesn't exist as it won't raise an exception
                node.removeAttribute(name);
        });
    }
    /**
     * Observe a style (as JS defines it) and update the node as needed.
     * @category dom, toc
     */
    function node_observe_style(node, style) {
        if (style instanceof o.Observable) {
            node_observe(node, style, st => {
                const ns = node.style;
                var props = Object.keys(st);
                for (var i = 0, l = props.length; i < l; i++) {
                    let x = props[i];
                    ns.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), st[x]);
                }
            });
        }
        else {
            // c is a MaybeObservableObject
            var st = style;
            var props = Object.keys(st);
            for (var i = 0, l = props.length; i < l; i++) {
                let x = props[i];
                node_observe(node, st[x], value => {
                    node.style.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value);
                });
            }
        }
    }
    /**
     * Observe a complex class definition and update the node as needed.
     * @category dom, toc
     */
    function node_observe_class(node, c) {
        if (!c)
            return;
        if (typeof c === 'string' || c.constructor !== Object) {
            // c is an Observable<string>
            node_observe(node, c, (str, chg) => {
                if (chg.hasOldValue())
                    _remove_class(node, chg.oldValue());
                _apply_class(node, str);
            });
        }
        else {
            var ob = c;
            // c is a MaybeObservableObject
            var props = Object.keys(ob);
            for (var i = 0, l = props.length; i < l; i++) {
                let x = props[i];
                node_observe(node, ob[x], applied => applied ? _apply_class(node, x) : _remove_class(node, x));
            }
        }
    }
    function _apply_class(node, c) {
        if (Array.isArray(c)) {
            for (var i = 0, l = c.length; i < l; i++) {
                _apply_class(node, c[i]);
            }
            return;
        }
        c = c == null ? null : c.toString();
        if (!c)
            return;
        var is_svg = node instanceof SVGElement;
        if (is_svg) {
            for (var _ of c.split(/\s+/g))
                if (_)
                    node.classList.add(_);
        }
        else
            node.className += ' ' + c;
    }
    function _remove_class(node, c) {
        if (Array.isArray(c)) {
            for (var i = 0, l = c.length; i < l; i++) {
                _remove_class(node, c[i]);
            }
            return;
        }
        c = c == null ? null : c.toString();
        if (!c)
            return;
        var is_svg = node instanceof SVGElement;
        var name = node.className;
        for (var _ of c.split(/\s+/g))
            if (_) {
                if (is_svg)
                    node.classList.remove(_);
                else
                    name = name.replace(' ' + _, '');
            }
        if (!is_svg)
            node.setAttribute('class', name);
    }
    /**
     * Register a `callback` to be called for the life-cycle event `sym` on `node`.
     * [`$init()`](#$init), [`$inserted()`](#inserted) and [`$removed()`](#$removed) are more commonly used, as well as the methods on [`Mixin`](#Mixin)
     *
     * This is mostly used internally.
     *
     * ```tsx
     * import { sym_inserted, node_on } from 'elt'
     *
     * var node = <div></div>
     * node_on(node, sym_inserted, (node, parent) => console.log('inserted'))
     *
     * // the former is achieved more easily by doing that:
     * import { $inserted } from 'elt'
     * <div>
     *   {$inserted((node, parent) => console.log('inserted'))}
     * </div>
     * ```
     *
     * @category dom, toc
     */
    function node_on(node, sym, callback) {
        var _a;
        (node[sym] = (_a = node[sym], (_a !== null && _a !== void 0 ? _a : []))).push(callback);
    }
    /**
     * Remove a previously associated `callback` from the life-cycle event `sym` for the `node`.
     * @category dom, toc
     */
    function node_off(node, sym, callback) {
        var _a;
        (node[sym] = (_a = node[sym], (_a !== null && _a !== void 0 ? _a : []))).filter(f => f !== callback);
    }
    /**
     * Remove all the nodes after `start` until `until` (included), calling `removed` and `deinit` as needed.
     * @category dom, toc
     */
    function node_remove_after(start, until) {
        if (!start)
            return;
        var next;
        while ((next = start.nextSibling)) {
            remove_and_deinit(next);
            if (next === until)
                break;
        }
    }

    (function ($bind) {
        // FIXME this lacks some debounce and throttle, or a way of achieving it.
        function setup_bind(obs, node_get, node_set, event = 'input') {
            return function (node) {
                const lock = o.exclusive_lock();
                /// When the observable changes, update the node
                node_observe(node, obs, value => {
                    lock(() => { node_set(node, value); });
                });
                node_add_event_listener(node, event, () => {
                    lock(() => { obs.set(node_get(node)); });
                });
            };
        }
        /**
         * Bind an observable to an input's value.
         * @category decorator, toc
         */
        function string(obs) {
            return setup_bind(obs, node => node.value, (node, value) => node.value = value);
        }
        $bind.string = string;
        /**
         * @category decorator, toc
         */
        function contenteditable(obs, as_html) {
            return setup_bind(obs, node => as_html ? node.innerHTML : node.innerText, (node, value) => {
                if (as_html) {
                    node.innerHTML = value;
                }
                else {
                    node.innerText = value;
                }
            });
        }
        $bind.contenteditable = contenteditable;
        /**
         * @category decorator, toc
         */
        function number(obs) {
            return setup_bind(obs, node => node.valueAsNumber, (node, value) => node.valueAsNumber = value);
        }
        $bind.number = number;
        /**
         * Bind bidirectionnally a `Date | null` observable to an `input`. Will only work on inputs
         * type `"date"` `"datetime"` `"datetime-local"`.
         *
         * ```tsx
         * const o_d = o(new Date() as Date | null)
         * <input type="date">{$bind.date(o_d)}</input>
         * ```
         *
         * @category decorator, toc
         */
        function date(obs) {
            return setup_bind(obs, node => node.valueAsDate, (node, value) => node.valueAsDate = value);
        }
        $bind.date = date;
        /**
         * Bind bidirectionnally a boolean observable to an input. Will only work if the input's type
         * is "radio" or "checkbox".
         *
         * ```tsx
         * const o_bool = o(false)
         * <input type="checkbox">{$bind.boolean(o_bool)}</input>
         * ```
         *
         * @category decorator, toc
         */
        function boolean(obs) {
            return setup_bind(obs, node => node.checked, (node, value) => node.checked = value, 'change');
        }
        $bind.boolean = boolean;
        /**
         * @category decorator, toc
         */
        function selected_index(obs) {
            return setup_bind(obs, node => node.selectedIndex, (node, value) => node.selectedIndex = value);
        }
        $bind.selected_index = selected_index;
    })(exports.$bind || (exports.$bind = {}));
    /**
     * Modify object properties of the current Node.
     *
     * Unfortunately, TSX does not pick up on the correct node type here. It however works without having
     * to type with regular js calls.
     *
     * ```tsx
     * <div>
     *   {$props<HTMLDivElement>({dir: 'left'})}
     * </div>
     * E.$DIV(
     *   $props({dir: 'left'})
     * )
     * ```
     *
     * @category decorator, toc
     */
    function $props(props) {
        var keys = Object.keys(props);
        return (node) => {
            for (var i = 0, l = keys.length; i < l; i++) {
                var k = keys[i];
                var val = props[k];
                if (o.isReadonlyObservable(val)) {
                    node_observe(node, val, value => node[k] = value);
                }
                else {
                    node[k] = val;
                }
            }
        };
    }
    /**
     * @category decorator, toc
     */
    function $class(...clss) {
        return (node) => {
            for (var i = 0, l = clss.length; i < l; i++) {
                node_observe_class(node, clss[i]);
            }
        };
    }
    /**
     * Update a node's id with a potentially observable value.
     *
     * ```tsx
     * <MyComponent>{$id('some-id')}</MyComponent>
     * ```
     *
     * > **Note**: You can use the `id` attribute on any element, be them Components or regular nodes, as it is forwarded.
     *
     * @category decorator, toc
     */
    function $id(id) {
        return (node) => {
            node_observe(node, id, id => node.id = id);
        };
    }
    /**
     * Update a node's title with a potentially observable value.
     * Used mostly when dealing with components since their base node attributes are no longer available.
     *
     * ```tsx
     * <MyComponent>{$title('Some title ! It generally appears on hover.')}</MyComponent>
     * E.$DIV(
     *   $title('hello there !')
     * )
     * ```
     * @category decorator, toc
     */
    function $title(title) {
        return (node) => {
            node_observe(node, title, title => node.title = title);
        };
    }
    /**
     * Update a node's style with potentially observable varlues
     *
     * ```tsx
     * const o_width = o('321px')
     * E.$DIV(
     *   $style({width: o_width, flex: '1'})
     * )
     * ```
     *
     * @category decorator, toc
     */
    function $style(...styles) {
        return (node) => {
            for (var i = 0, l = styles.length; i < l; i++) {
                node_observe_style(node, styles[i]);
            }
        };
    }
    /**
     * Observe an observable and tie the observation to the node this is added to
     * @category decorator, toc
     */
    // export function $observe<T>(a: o.Observer<T>): Decorator<Node>
    function $observe(a, cbk, obs_cbk) {
        // export function $observe<T>(a: any, cbk?: any): Decorator<Node> {
        return node => {
            var res = node_observe(node, a, (nval, chg) => cbk(nval, chg, node));
            if (res && obs_cbk)
                obs_cbk(res);
        };
    }
    function $on(event, _listener, useCapture = false) {
        return function $on(node) {
            if (typeof event === 'string')
                node.addEventListener(event, ev => _listener(ev), useCapture);
            else {
                for (var n of event) {
                    node.addEventListener(n, ev => _listener(ev), useCapture);
                }
            }
        };
    }
    /**
     * Add a callback on the click event, or touchend if we are on a mobile
     * device.
     * @category decorator, toc
     */
    function $click(cbk, capture) {
        return function $click(node) {
            // events don't trigger on safari if not pointer.
            node.style.cursor = 'pointer';
            node_add_event_listener(node, 'click', cbk);
        };
    }
    /**
     * ```jsx
     *  <MyComponent>{$init(node => console.log(`This node was just created and its observers are now live`))}</MyComponent>
     * ```
     * @category decorator, toc
     */
    function $init(fn) {
        return node => {
            node_on(node, sym_init, fn);
        };
    }
    /**
     * Call the `fn` callback when the decorated `node` is inserted into the DOM with
     * itself as first argument.
     *
     * ```tsx
     * append_child_and_mount(document.body, <div>{$inserted(n => {
     *   console.log(`I am now in the DOM and `, n.parentNode, ` is document.body`)
     * })}</div>)
     * ```
     *
     * @category decorator, toc
     */
    function $inserted(fn) {
        return (node) => {
            node_on(node, sym_inserted, fn);
        };
    }
    /**
     * Run a callback when the node is removed from its holding document.
     *
     * ```jsx
     * import { o, $removed } from 'elt'
     * const o_some_condition = o(true)
     *
     * document.appendChild($If(o_some_condition, () => <div>
     *   {$removed((node, parent) => {
     *     console.log(`I was removed.`)
     *   })}
     * </div>))
     * ```
     * @category decorator, toc
     */
    function $removed(fn) {
        return (node) => {
            node_on(node, sym_removed, fn);
        };
    }
    var _noscrollsetup = false;
    /**
     * Used by the `scrollable()` decorator
     */
    function _setUpNoscroll() {
        document.body.addEventListener('touchmove', function event(ev) {
            // If no div marked as scrollable set the moving attribute, then simply don't scroll.
            if (!ev.scrollable)
                ev.preventDefault();
        }, false);
        _noscrollsetup = true;
    }
    /**
     * Setup scroll so that touchstart and touchmove events don't
     * trigger the ugly scroll band on mobile devices.
     *
     * Calling this functions makes anything not marked scrollable as non-scrollable.
     * @category decorator, toc
     */
    function $scrollable() {
        return (node) => {
            if (!_noscrollsetup)
                _setUpNoscroll();
            var style = node.style;
            style.overflowY = 'auto';
            style.overflowX = 'auto';
            // seems like typescript doesn't have this property yet
            style.webkitOverflowScrolling = 'touch';
            node_add_event_listener(node, 'touchstart', ev => {
                if (ev.currentTarget.scrollTop == 0) {
                    node.scrollTop = 1;
                }
                else if (node.scrollTop + node.offsetHeight >= node.scrollHeight - 1)
                    node.scrollTop -= 1;
            });
            node_add_event_listener(node, 'touchmove', ev => {
                if (ev.currentTarget.offsetHeight < ev.currentTarget.scrollHeight)
                    ev.scrollable = true;
            });
        };
    }

    /**
     * A `Mixin` is an object that is tied to a DOM Node and its lifecycle. This class
     * is the base class all Mixins should derive from.
     *
     * Mixins can "comunicate" with each other by asking other mixins present on a given
     * node.
     *
     * Extending a Mixin allows the developper to be notified whenever the node
     * is first created by the `d()` function, when it gets inserted into the DOM
     * by overloading the `inserted()` method or when it gets removed from the DOM
     * by overloading the `removed()` method.
     *
     * Additionally, it provides the `observe()` method that ties the observing of an
     * Observable to the Node's presence in the DOM : if the `Node` is inserted, then
     * the observers start listening to their observable. If it gets removed, they stop.
     * Limiting the observing this way ensures that we avoid creating circular references
     * and thus memory leaks.
     *
     * If you intend to store a reference to the associated Node in your Mixin when called
     * with `init()` or `inserted()`, please make sure that you set it to `null` in the
     * `removed()` call.
     * @category dom, toc
     */
    class Mixin {
        constructor() {
            this.node = null;
            /** @category internal */
            this.__observers = [];
        }
        /**
         * Get a Mixin by its class on the given node or its parents.
         *
         * You do not need to overload this static method.
         *
         * ```typescript
         * class MyMixin extends Mixin {  }
         *
         * // At some point, we add this mixin to a node.
         *
         * var mx = MyMixin.get(node) // This gets the instance that was added to the node, if it exists.
         * ```
         *
         * @param node The node at which we'll start looking for the mixin
         * @param recursive Set to false if you do not want the mixin to be searched on the
         *   node parent's if it was not found.
         */
        static get(node, recursive = true) {
            let iter = node; // yeah yeah, I know, it's an EventTarget as well but hey.
            while (iter) {
                var mixin_iter = iter[sym_mixins];
                while (mixin_iter) {
                    if (mixin_iter instanceof this)
                        return mixin_iter;
                }
                if (!recursive)
                    break;
                iter = iter.parentNode;
            }
            return null;
        }
        /**
         * To be used with decorators
         */
        static onThisNode(cbk) {
            return (node) => {
            };
        }
        /**
         * Remove the mixin from this node. Observers created with `observe()` will
         * stop observing, but `removed()` will not be called.
         * @param node
         */
        removeFromNode() {
            node_remove_mixin(this.node, this);
            this.node = null; // we force the node to null to help with garbage collection.
        }
        listen(name, listener, useCapture) {
            if (typeof name === 'string')
                this.node.addEventListener(name, (ev) => listener(ev), useCapture);
            else
                for (var n of name) {
                    this.node.addEventListener(n, (ev) => listener(ev), useCapture);
                }
        }
        /**
         * Observe and Observable and return the observer that was created
         */
        observe(obs, fn) {
            return node_observe(this.node, obs, fn);
        }
        unobserve(obs) {
            this.__observers = this.__observers.filter(ob => obs !== ob && obs !== ob.fn);
            return node_unobserve(this.node, obs);
        }
    }
    /**
     * The Component is the core class of your TSX components.
     *
     * It is just a Mixin that has a `render()` method and that defines the `attrs`
     * property which will restrict what attributes the component can be created with.
     * All attributes must extend the base `Attrs` class.
     * @category dom, toc
     */
    class Component extends Mixin {
        // attrs: Attrs
        constructor(attrs) {
            super();
            this.attrs = attrs;
        }
    }
    /**
     * Associate a `mixin` to a `node`.
     *
     * All it does is add it to the chained list of mixins accessible on `node[sym_mixins]` and
     * set `mixin.node` to the corresponding node.
     *
     * In general, to add a mixin to a node, prefer adding it to its children.
     *
     * ```tsx
     * var my_mixin = new Mixin()
     *
     * // these are equivalent
     * <div>{my_mixin}</div>
     * var d = <div/>; node_add_mixin(d, mixin);
     * ```
     */
    function node_add_mixin(node, mixin) {
        mixin.__next_mixin = node[sym_mixins];
        node[sym_mixins] = mixin;
        mixin.node = node;
        if (mixin.init) {
            mixin.init = mixin.init.bind(mixin);
            node_on(node, sym_init, mixin.init);
        }
        if (mixin.removed) {
            mixin.removed = mixin.removed.bind(mixin);
            node_on(node, sym_removed, mixin.removed);
        }
        if (mixin.inserted) {
            mixin.inserted = mixin.inserted.bind(mixin);
            node_on(node, sym_inserted, mixin.inserted);
        }
    }
    /**
     * Remove a Mixin from the array of mixins associated with this Node.
     * @param node The node the mixin will be removed from
     * @param mixin The mixin object we want to remove
     */
    function node_remove_mixin(node, mixin) {
        var mx = node[sym_mixins];
        var found = false;
        if (!mx)
            return;
        if (mx === mixin) {
            found = true;
            node[sym_mixins] = mixin.__next_mixin;
        }
        else {
            var iter = mx;
            while (iter) {
                if (iter.__next_mixin === mixin) {
                    found = true;
                    iter.__next_mixin = mixin.__next_mixin;
                    break;
                }
            }
        }
        if (found) {
            if (mixin.init)
                node_off(node, sym_init, mixin.init);
            if (mixin.inserted)
                node_off(node, sym_inserted, mixin.inserted);
            if (mixin.removed)
                node_off(node, sym_removed, mixin.removed);
            for (var ob of mixin.__observers) {
                node_unobserve(node, ob);
            }
        }
    }

    /**
     * Control structures to help with readability.
     */
    /**
     * Get a node that can be inserted into the DOM from an insertable `i`. The returned value can be
     * a single `Node` or a `DocumentFragment` if the insertable was an array.
     *
     * Note that this function will ignore Decorators, Mixins and other non-renderable elements.
     *
     * @param i The insertable
     *
     * @category dom, toc
     */
    function get_node_from_insertable(i) {
        if (i instanceof Node)
            return i;
        if (i instanceof Array) {
            const res = document.createDocumentFragment();
            for (var n of i) {
                res.appendChild(get_node_from_insertable(n));
            }
            return res;
        }
        if (i instanceof o.Observable) {
            return $Display(i);
        }
        if (i != null) {
            return document.createTextNode(i.toString());
        }
        return document.createComment('' + i);
    }
    /**
     * A subclass of `#Verb` made to store nodes between two comments.
     *
     * Can be used as a base to build verbs more easily.
     * @category verb, toc
     */
    var cmt_count = 0;
    class CommentContainer extends Mixin {
        constructor() {
            super(...arguments);
            this.end = document.createComment(`-- ${this.constructor.name} ${cmt_count++} --`);
        }
        init(node) {
            node.parentNode.insertBefore(this.end, node.nextSibling);
        }
        /**
         * Remove all nodes between this.start and this.node
         */
        clear() {
            if (this.end.previousSibling !== this.node)
                node_remove_after(this.node, this.end.previousSibling);
        }
        setContents(cts) {
            this.clear();
            // Insert the new comment before the end
            insert_before_and_init(this.node.parentNode, cts, this.end);
        }
    }
    /**
     * Displays and actualises the content of an Observable containing
     * Node, string or number into the DOM.
     */
    class Displayer extends CommentContainer {
        constructor(_obs) {
            super();
            this._obs = _obs;
        }
        init(node) {
            super.init(node);
            this.observe(this._obs, value => this.setContents(get_node_from_insertable(value)));
        }
    }
    /**
     * Write and update the string value of an observable value into
     * a Text node.
     *
     * This verb is used whenever an observable is passed as a child to a node.
     *
     * ```tsx
     * import { o, $Display, $Fragment as $ } from 'elt'
     *
     * const o_text = o('text')
     * document.body.appendChild(<$>
     *   {o_text} is the same as {$Display(o_text)}
     * </$>)
     * ```
     *
     * @category verb, toc
     */
    function $Display(obs) {
        if (!(obs instanceof o.Observable)) {
            return get_node_from_insertable(obs);
        }
        return e(document.createComment('$Display'), new Displayer(obs));
    }
    /**
     * @category verb, toc
     *
     * Display content depending on the value of a `condition`, which can be an observable.
     *
     * If `condition` is not an observable, then the call to `$If` is resolved immediately without using
     * an intermediary observable.
     *
     * If `condition` is readonly, then the observables given to `display` and `display_otherwise` are
     * Readonly as well.
     *
     * For convenience, the truth value is given typed as a `o.Observable<NonNullable<...>>` in `display`,
     * since there is no way `null` or `undefined` could make their way here.
     *
     * ```tsx
     * // o_obj is nullable.
     * const o_obj = o({a: 'hello'} as {a: string} | null)
     *
     * $If(o_obj,
     *   // o_truthy here is o.Observable<{a: string}>
     *   // which is why we can safely use .p('a') without typescript complaining
     *   o_truthy => <>{o_truthy.p('a')}
     * )
     * ```
     */
    function $If(condition, display, display_otherwise) {
        // ts bug on condition.
        if (typeof display === 'function' && !(condition instanceof o.Observable)) {
            return condition ?
                get_node_from_insertable(display(condition))
                : get_node_from_insertable(display_otherwise ?
                    (display_otherwise(null))
                    : document.createComment('false'));
        }
        return e(document.createComment('$If'), new $If.ConditionalDisplayer(display, condition, display_otherwise));
    }
    (function ($If) {
        /**
         * Implementation of the `DisplayIf()` verb.
         * @category internal
         */
        class ConditionalDisplayer extends Displayer {
            constructor(display, condition, display_otherwise) {
                super(condition.tf((cond, old, v) => {
                    if (old !== o.NOVALUE && !!cond === !!old && v !== o.NOVALUE)
                        return v;
                    if (cond) {
                        return display(condition);
                    }
                    else if (display_otherwise) {
                        return display_otherwise(condition);
                    }
                    else {
                        return null;
                    }
                }));
                this.display = display;
                this.condition = condition;
                this.display_otherwise = display_otherwise;
            }
        }
        $If.ConditionalDisplayer = ConditionalDisplayer;
    })($If || ($If = {}));
    /**
     * @category verb, toc
     *
     * Repeats the `render` function for each element in `ob`, optionally separating each rendering
     * with the result of the `separator` function.
     *
     * If `ob` is an observable, `$Repeat` will update the generated nodes to match the changes.
     * If it is a `o.ReadonlyObservable`, then the `render` callback will be provided a read only observable.
     *
     * `ob` is not converted to an observable if it was not one, in which case the results are executed
     * right away and only once.
     *
     * ```tsx
     * const o_mylist = o(['hello', 'world'])
     *
     * <div>
     *   {Repeat(
     *      o_mylist,
     *      o_item => <Button click={event => o_item.mutate(value => value + '!')}/>,
     *      () => <div class='separator'/> // this div will be inserted between each button.
     *   )}
     * </div>
     * ```
     */
    function $Repeat(ob, render, separator) {
        if (!(ob instanceof o.Observable)) {
            const arr = ob;
            const final = new Array(separator ? arr.length * 2 - 1 : arr.length);
            var i = 0;
            var j = 0;
            for (var elt of arr) {
                arr[i++] = render(elt, j++);
                if (separator)
                    arr[i++] = separator(j - 1);
            }
            return get_node_from_insertable(final);
        }
        return e(document.createComment('$Repeat'), new $Repeat.Repeater(ob, render, separator));
    }
    (function ($Repeat) {
        /**
         *  Repeats content.
         * @category internal
         */
        class Repeater extends Mixin {
            constructor(ob, renderfn, separator) {
                super();
                this.renderfn = renderfn;
                this.separator = separator;
                this.positions = [];
                this.next_index = 0;
                this.lst = [];
                this.child_obs = [];
                this.obs = o(ob);
            }
            init() {
                this.observe(this.obs, lst => {
                    this.lst = lst || [];
                    const diff = lst.length - this.next_index;
                    if (diff < 0)
                        this.removeChildren(-diff);
                    if (diff > 0)
                        this.appendChildren(diff);
                });
            }
            /**
             * Generate the next element to append to the list.
             */
            next(fr) {
                if (this.next_index >= this.lst.length)
                    return false;
                // here, we *KNOW* it represents a defined value.
                var ob = this.obs.p(this.next_index);
                this.child_obs.push(ob);
                if (this.separator && this.next_index > 0) {
                    fr.appendChild(get_node_from_insertable(this.separator(this.next_index)));
                }
                var node = get_node_from_insertable(this.renderfn(ob, this.next_index));
                this.positions.push(node instanceof DocumentFragment ? node.lastChild : node);
                fr.appendChild(node);
                this.next_index++;
                return true;
            }
            appendChildren(count) {
                const parent = this.node.parentNode;
                if (!parent)
                    return;
                var fr = document.createDocumentFragment();
                while (count-- > 0) {
                    if (!this.next(fr))
                        break;
                }
                insert_before_and_init(parent, fr, this.node);
            }
            removeChildren(count) {
                var _a;
                if (this.next_index === 0 || count === 0)
                    return;
                // Détruire jusqu'à la position concernée...
                this.next_index = this.next_index - count;
                node_remove_after((_a = this.positions[this.next_index - 1], (_a !== null && _a !== void 0 ? _a : this.node)), this.positions[this.positions.length - 1]);
                this.child_obs = this.child_obs.slice(0, this.next_index);
                this.positions = this.positions.slice(0, this.next_index);
            }
        }
        $Repeat.Repeater = Repeater;
    })($Repeat || ($Repeat = {}));
    /**
     * Similarly to `$Repeat`, `$RepeatScroll` repeats the `render` function for each element in `ob`,
     * optionally separated by the results of `separator`, until the elements overflow past the
     * bottom border of the current parent marked `overflow-y: auto`.
     *
     * As the user scrolls, new items are being added. Old items are *not* discarded and stay above.
     *
     * It will generate `scroll_buffer_size` elements at a time (or 10 if not specified), waiting for
     * the next repaint with `requestAnimationFrame()` between chunks.
     *
     * Unlike `Repeat`, `RepeatScroll` turns `ob` into an `Observable` internally even if it wasn't one.
     *
     * > **Note** : while functional, RepeatScroll is not perfect. A "VirtualScroll" behaviour is in the
     * > roadmap to only maintain the right amount of elements on screen.
     *
     * @category verb, toc
     */
    function $RepeatScroll(ob, render, options = {}) {
        // we cheat the typesystem, which is not great, but we know what we're doing.
        return e(document.createComment('$RepeatScroll'), new $RepeatScroll.ScrollRepeater(o(ob), render, options));
    }
    (function ($RepeatScroll) {
        /**
         * Repeats content and append it to the DOM until a certain threshold
         * is meant. Use it with `scrollable()` on the parent..
         * @category internal
         */
        class ScrollRepeater extends $Repeat.Repeater {
            constructor(ob, renderfn, options) {
                var _a, _b;
                super(ob, renderfn);
                this.options = options;
                this.parent = null;
                this.scroll_buffer_size = (_a = this.options.scroll_buffer_size, (_a !== null && _a !== void 0 ? _a : 10));
                this.threshold_height = (_b = this.options.threshold_height, (_b !== null && _b !== void 0 ? _b : 500));
                this.separator = this.options.separator;
                this.onscroll = () => {
                    if (!this.parent)
                        return;
                    this.appendChildren();
                };
            }
            /**
             * Append `count` children if the parent was not scrollable (just like Repeater),
             * or append elements until we've added past the bottom of the container.
             */
            appendChildren() {
                if (!this.parent)
                    // if we have no scrollable parent (yet, if just inited), then just append items
                    return super.appendChildren(this.scroll_buffer_size);
                // Instead of appending all the count, break it down to bufsize packets.
                const bufsize = this.scroll_buffer_size;
                const p = this.parent;
                const append = () => {
                    if (this.next_index < this.lst.length && p.scrollHeight - (p.clientHeight + p.scrollTop) < this.threshold_height) {
                        super.appendChildren(bufsize);
                        requestAnimationFrame(append);
                    }
                };
                // We do not try appending immediately ; some observables may modify current
                // items height right after this function ends, which can lead to a situation
                // where we had few elements that were very high and went past the threshold
                // that would get very small suddenly, but since they didn't get the chance
                // to do that, append stops because it is past the threshold right now and
                // thus leaves a lot of blank space.
                requestAnimationFrame(append);
            }
            inserted() {
                // do not process this if the node is not inserted.
                if (!this.node.isConnected)
                    return;
                // Find parent with the overflow-y
                var iter = this.node.parentElement;
                while (iter) {
                    var style = getComputedStyle(iter);
                    if (style.overflowY === 'auto' || style.msOverflowY === 'auto' || style.msOverflowY === 'scrollbar') {
                        this.parent = iter;
                        break;
                    }
                    iter = iter.parentElement;
                }
                if (!this.parent) {
                    console.warn(`Scroll repeat needs a parent with overflow-y: auto`);
                    this.appendChildren();
                    return;
                }
                this.parent.addEventListener('scroll', this.onscroll);
                this.observe(this.obs, lst => {
                    this.lst = lst || [];
                    const diff = lst.length - this.next_index;
                    if (diff < 0)
                        this.removeChildren(-diff);
                    if (diff > 0)
                        this.appendChildren();
                });
            }
            removed() {
                // remove Scrolling
                if (!this.parent)
                    return;
                this.parent.removeEventListener('scroll', this.onscroll);
                this.parent = null;
            }
        }
        $RepeatScroll.ScrollRepeater = ScrollRepeater;
    })($RepeatScroll || ($RepeatScroll = {}));
    function $Switch(obs) {
        return new $Switch.Switcher(obs);
    }
    (function ($Switch) {
        /**
         * Used by the `Switch()` verb.
         * @category internal
         */
        class Switcher extends o.VirtualObservable {
            constructor(obs) {
                super([obs]);
                this.obs = obs;
                this.cases = [];
                this.passthrough = () => null;
                this.prev_case = null;
            }
            getter([nval]) {
                const cases = this.cases;
                for (var c of cases) {
                    const val = c[0];
                    if (val === nval || (typeof val === 'function' && val(nval))) {
                        if (this.prev_case === val) {
                            return this.prev;
                        }
                        this.prev_case = val;
                        const fn = c[1];
                        return (this.prev = fn(this.obs));
                    }
                }
                if (this.prev_case === this.passthrough)
                    return this.prev;
                this.prev_case = this.passthrough;
                return (this.prev = this.passthrough ? this.passthrough() : null);
            }
            $Case(value, fn) {
                this.cases.push([value, fn]);
                return this;
            }
            $Else(fn) {
                this.passthrough = fn;
                return this;
            }
        }
        $Switch.Switcher = Switcher;
    })($Switch || ($Switch = {}));

    ////////////////////////////////////////////////////////
    const SVG = "http://www.w3.org/2000/svg";
    const NS = {
        // SVG nodes, shamelessly stolen from React.
        svg: SVG,
        circle: SVG,
        clipPath: SVG,
        defs: SVG,
        desc: SVG,
        ellipse: SVG,
        feBlend: SVG,
        feColorMatrix: SVG,
        feComponentTransfer: SVG,
        feComposite: SVG,
        feConvolveMatrix: SVG,
        feDiffuseLighting: SVG,
        feDisplacementMap: SVG,
        feDistantLight: SVG,
        feFlood: SVG,
        feFuncA: SVG,
        feFuncB: SVG,
        feFuncG: SVG,
        feFuncR: SVG,
        feGaussianBlur: SVG,
        feImage: SVG,
        feMerge: SVG,
        feMergeNode: SVG,
        feMorphology: SVG,
        feOffset: SVG,
        fePointLight: SVG,
        feSpecularLighting: SVG,
        feSpotLight: SVG,
        feTile: SVG,
        feTurbulence: SVG,
        filter: SVG,
        foreignObject: SVG,
        g: SVG,
        image: SVG,
        line: SVG,
        linearGradient: SVG,
        marker: SVG,
        mask: SVG,
        metadata: SVG,
        path: SVG,
        pattern: SVG,
        polygon: SVG,
        polyline: SVG,
        radialGradient: SVG,
        rect: SVG,
        stop: SVG,
        switch: SVG,
        symbol: SVG,
        text: SVG,
        textPath: SVG,
        tspan: SVG,
        use: SVG,
        view: SVG,
    };
    function isComponent(kls) {
        return kls.prototype instanceof Component;
    }
    var _decorator_map = new WeakMap();
    function e(elt, ...children) {
        if (!elt)
            throw new Error(`e() needs at least a string, a function or a Component`);
        let node = null; // just to prevent the warnings later
        var is_basic_node = typeof elt === 'string' || elt instanceof Node;
        // const fragment = get_dom_insertable(children) as DocumentFragment
        var i = 0;
        var l = 0;
        var attrs = {};
        var decorators = [];
        var mixins = [];
        var renderables = [];
        e.separate_children_from_rest(children, attrs, decorators, mixins, renderables);
        if (is_basic_node) {
            // create a simple DOM node
            if (typeof elt === 'string') {
                var ns = NS[elt]; // || attrs.xmlns
                node = (ns ? document.createElementNS(ns, elt) : document.createElement(elt));
            }
            else {
                node = elt;
            }
            for (i = 0, l = renderables.length; i < l; i++) {
                var c = e.renderable_to_node(renderables[i]);
                if (c) {
                    append_child_and_init(node, c);
                }
            }
        }
        else if (isComponent(elt)) {
            // elt is an instantiator / Component
            var comp = new elt(attrs);
            node = comp.render(renderables);
            node_add_mixin(node, comp);
        }
        else if (typeof elt === 'function') {
            // elt is just a creator function
            node = elt(attrs, renderables);
        }
        // we have to cheat a bit here.
        e.handle_attrs(node, attrs, is_basic_node);
        // Handle decorators on the node
        for (i = 0, l = decorators.length; i < l; i++) {
            e.handle_decorator(node, decorators[i]);
        }
        // Add the mixins
        for (i = 0, l = mixins.length; i < l; i++) {
            node_add_mixin(node, mixins[i]);
        }
        return node;
    }
    /**
     * Creates a document fragment.
     *
     * The JSX namespace points `JSX.Fragment` to this function.
     *
     * While it is a "valid" component in the eyes of ELT, no life-cycle event will ever be triggered
     * on a `$Fragment`.
     *
     * ```tsx
     * // If using jsxFactory, you have to import $Fragment and use it
     * import { $Fragment as $ } from 'elt'
     *
     * document.body.appendChild(<$>
     *   <p>Content</p>
     *   <p>More Content</p>
     * </$>)
     *
     * // If using jsxNamespace as "e" or "E", the following works out of the box
     * document.body.appendChild(<>
     *   <p>Content</p>
     *   <p>More Content</p>
     * </>)
     *
     * ```
     *
     * @category dom, toc
     */
    function $Fragment(...children) {
        // This is a trick ! It is not actually an element !
        const fr = document.createDocumentFragment();
        return e(fr, children);
    }
    (function (e) {
        /**
         * Separates decorators and mixins from nodes or soon-to-be-nodes from children.
         * Returns a tuple containing the decorators/mixins/attrs in one part and the children in the other.
         * The resulting arrays are 1-dimensional and do not contain null or undefined.
         * @category internal
         */
        function separate_children_from_rest(children, attrs, decorators, mixins, chld) {
            for (var i = 0, l = children.length; i < l; i++) {
                var c = children[i];
                if (c == null)
                    continue;
                if (Array.isArray(c)) {
                    separate_children_from_rest(c, attrs, decorators, mixins, chld);
                }
                else if (c instanceof Node || typeof c === 'string' || typeof c === 'number' || o.isReadonlyObservable(c)) {
                    chld.push(c);
                }
                else if (typeof c === 'function') {
                    var cmt = document.createComment('decorator ' + c.name);
                    _decorator_map.set(c, cmt);
                    chld.push(cmt);
                    decorators.push(c);
                }
                else if (c instanceof Mixin) {
                    mixins.push(c);
                }
                else {
                    // We just copy the attrs properties onto the attrs object
                    Object.assign(attrs, c);
                }
            }
        }
        e.separate_children_from_rest = separate_children_from_rest;
        /**
         * @category internal
         */
        function renderable_to_node(r) {
            if (r == null)
                return null;
            else if (typeof r === 'string' || typeof r === 'number')
                return document.createTextNode(r.toString());
            else if (o.isReadonlyObservable(r))
                return $Display(r);
            else
                return r;
        }
        e.renderable_to_node = renderable_to_node;
        /**
         * @category internal
         */
        function handle_decorator(node, decorator) {
            var res;
            var dec_iter = decorator;
            // while the decorator returns a decorator, keep calling it.
            while (typeof (res = dec_iter(node)) === 'function') {
                dec_iter = res;
            }
            // If it returns nothing or the node itself, don't do anything
            if (res == null || res === node)
                return;
            if (res instanceof Mixin) {
                node_add_mixin(node, res);
                return;
            }
            var nd = renderable_to_node(res);
            if (nd == null)
                return;
            var cmt = _decorator_map.get(decorator);
            // If there was no comment associated with this decorator, do nothing
            if (!cmt)
                return;
            // insert the resulting node right next to the comment
            insert_before_and_init(node, nd, cmt);
        }
        e.handle_decorator = handle_decorator;
        /**
         * Handle attributes for simple nodes
         * @category internal
         */
        function handle_attrs(node, attrs, is_basic_node) {
            var keys = Object.keys(attrs);
            for (var i = 0, l = keys.length; i < l; i++) {
                var key = keys[i];
                if (key === 'class') {
                    node_observe_class(node, attrs.class);
                }
                else if (key === 'style') {
                    node_observe_style(node, attrs.style);
                }
                else if (key === 'id' || is_basic_node) {
                    node_observe_attribute(node, key, attrs[key]);
                }
            }
        }
        e.handle_attrs = handle_attrs;
        function mkwrapper(elt) {
            return (...args) => {
                return e(elt, ...args);
            };
        }
        e.mkwrapper = mkwrapper;
        /** @category internal */
        e.$A = mkwrapper('a');
        /** @category internal */
        e.$ABBR = mkwrapper('abbr');
        /** @category internal */
        e.$ADDRESS = mkwrapper('address');
        /** @category internal */
        e.$AREA = mkwrapper('area');
        /** @category internal */
        e.$ARTICLE = mkwrapper('article');
        /** @category internal */
        e.$ASIDE = mkwrapper('aside');
        /** @category internal */
        e.$AUDIO = mkwrapper('audio');
        /** @category internal */
        e.$B = mkwrapper('b');
        /** @category internal */
        e.$BASE = mkwrapper('base');
        /** @category internal */
        e.$BDI = mkwrapper('bdi');
        /** @category internal */
        e.$BDO = mkwrapper('bdo');
        /** @category internal */
        e.$BIG = mkwrapper('big');
        /** @category internal */
        e.$BLOCKQUOTE = mkwrapper('blockquote');
        /** @category internal */
        e.$BODY = mkwrapper('body');
        /** @category internal */
        e.$BR = mkwrapper('br');
        /** @category internal */
        e.$BUTTON = mkwrapper('button');
        /** @category internal */
        e.$CANVAS = mkwrapper('canvas');
        /** @category internal */
        e.$CAPTION = mkwrapper('caption');
        /** @category internal */
        e.$CITE = mkwrapper('cite');
        /** @category internal */
        e.$CODE = mkwrapper('code');
        /** @category internal */
        e.$COL = mkwrapper('col');
        /** @category internal */
        e.$COLGROUP = mkwrapper('colgroup');
        /** @category internal */
        e.$DATA = mkwrapper('data');
        /** @category internal */
        e.$DATALIST = mkwrapper('datalist');
        /** @category internal */
        e.$DD = mkwrapper('dd');
        /** @category internal */
        e.$DEL = mkwrapper('del');
        /** @category internal */
        e.$DETAILS = mkwrapper('details');
        /** @category internal */
        e.$DFN = mkwrapper('dfn');
        /** @category internal */
        e.$DIALOG = mkwrapper('dialog');
        /** @category internal */
        e.$DIV = mkwrapper('div');
        /** @category internal */
        e.$DL = mkwrapper('dl');
        /** @category internal */
        e.$DT = mkwrapper('dt');
        /** @category internal */
        e.$EM = mkwrapper('em');
        /** @category internal */
        e.$EMBED = mkwrapper('embed');
        /** @category internal */
        e.$FIELDSET = mkwrapper('fieldset');
        /** @category internal */
        e.$FIGCAPTION = mkwrapper('figcaption');
        /** @category internal */
        e.$FIGURE = mkwrapper('figure');
        /** @category internal */
        e.$FOOTER = mkwrapper('footer');
        /** @category internal */
        e.$FORM = mkwrapper('form');
        /** @category internal */
        e.$H1 = mkwrapper('h1');
        /** @category internal */
        e.$H2 = mkwrapper('h2');
        /** @category internal */
        e.$H3 = mkwrapper('h3');
        /** @category internal */
        e.$H4 = mkwrapper('h4');
        /** @category internal */
        e.$H5 = mkwrapper('h5');
        /** @category internal */
        e.$H6 = mkwrapper('h6');
        /** @category internal */
        e.$HEAD = mkwrapper('head');
        /** @category internal */
        e.$HEADER = mkwrapper('header');
        /** @category internal */
        e.$HR = mkwrapper('hr');
        /** @category internal */
        e.$HTML = mkwrapper('html');
        /** @category internal */
        e.$I = mkwrapper('i');
        /** @category internal */
        e.$IFRAME = mkwrapper('iframe');
        /** @category internal */
        e.$IMG = mkwrapper('img');
        /** @category internal */
        e.$INPUT = mkwrapper('input');
        /** @category internal */
        e.$INS = mkwrapper('ins');
        /** @category internal */
        e.$KBD = mkwrapper('kbd');
        /** @category internal */
        e.$KEYGEN = mkwrapper('keygen');
        /** @category internal */
        e.$LABEL = mkwrapper('label');
        /** @category internal */
        e.$LEGEND = mkwrapper('legend');
        /** @category internal */
        e.$LI = mkwrapper('li');
        /** @category internal */
        e.$LINK = mkwrapper('link');
        /** @category internal */
        e.$MAIN = mkwrapper('main');
        /** @category internal */
        e.$MAP = mkwrapper('map');
        /** @category internal */
        e.$MARK = mkwrapper('mark');
        /** @category internal */
        e.$MENU = mkwrapper('menu');
        /** @category internal */
        e.$MENUITEM = mkwrapper('menuitem');
        /** @category internal */
        e.$META = mkwrapper('meta');
        /** @category internal */
        e.$METER = mkwrapper('meter');
        /** @category internal */
        e.$NAV = mkwrapper('nav');
        /** @category internal */
        e.$NOSCRIPT = mkwrapper('noscript');
        /** @category internal */
        e.$OBJECT = mkwrapper('object');
        /** @category internal */
        e.$OL = mkwrapper('ol');
        /** @category internal */
        e.$OPTGROUP = mkwrapper('optgroup');
        /** @category internal */
        e.$OPTION = mkwrapper('option');
        /** @category internal */
        e.$OUTPUT = mkwrapper('output');
        /** @category internal */
        e.$P = mkwrapper('p');
        /** @category internal */
        e.$PARAM = mkwrapper('param');
        /** @category internal */
        e.$PICTURE = mkwrapper('picture');
        /** @category internal */
        e.$PRE = mkwrapper('pre');
        /** @category internal */
        e.$PROGRESS = mkwrapper('progress');
        /** @category internal */
        e.$Q = mkwrapper('q');
        /** @category internal */
        e.$RP = mkwrapper('rp');
        /** @category internal */
        e.$RT = mkwrapper('rt');
        /** @category internal */
        e.$RUBY = mkwrapper('ruby');
        /** @category internal */
        e.$S = mkwrapper('s');
        /** @category internal */
        e.$SAMP = mkwrapper('samp');
        /** @category internal */
        e.$SCRIPT = mkwrapper('script');
        /** @category internal */
        e.$SECTION = mkwrapper('section');
        /** @category internal */
        e.$SELECT = mkwrapper('select');
        /** @category internal */
        e.$SMALL = mkwrapper('small');
        /** @category internal */
        e.$SOURCE = mkwrapper('source');
        /** @category internal */
        e.$SPAN = mkwrapper('span');
        /** @category internal */
        e.$STRONG = mkwrapper('strong');
        /** @category internal */
        e.$STYLE = mkwrapper('style');
        /** @category internal */
        e.$SUB = mkwrapper('sub');
        /** @category internal */
        e.$SUMMARY = mkwrapper('summary');
        /** @category internal */
        e.$SUP = mkwrapper('sup');
        /** @category internal */
        e.$TABLE = mkwrapper('table');
        /** @category internal */
        e.$TBODY = mkwrapper('tbody');
        /** @category internal */
        e.$TD = mkwrapper('td');
        /** @category internal */
        e.$TEXTAREA = mkwrapper('textarea');
        /** @category internal */
        e.$TFOOT = mkwrapper('tfoot');
        /** @category internal */
        e.$TH = mkwrapper('th');
        /** @category internal */
        e.$THEAD = mkwrapper('thead');
        /** @category internal */
        e.$TIME = mkwrapper('time');
        /** @category internal */
        e.$TITLE = mkwrapper('title');
        /** @category internal */
        e.$TR = mkwrapper('tr');
        /** @category internal */
        e.$TRACK = mkwrapper('track');
        /** @category internal */
        e.$U = mkwrapper('u');
        /** @category internal */
        e.$UL = mkwrapper('ul');
        /** @category internal */
        e.$VAR = mkwrapper('var');
        /** @category internal */
        e.$VIDEO = mkwrapper('video');
        /** @category internal */
        e.$WBR = mkwrapper('wbr');
        /**
         * An alias to conform to typescript's JSX
         * @category internal
         */
        e.createElement = e;
        /** @category internal */
        e.Fragment = $Fragment; //(at: Attrs, ch: DocumentFragment): e.JSX.Element
    })(e || (e = {}));
    if ('undefined' !== typeof window && typeof window.E === 'undefined' || typeof global !== 'undefined' && typeof (global.E) === 'undefined') {
        window.E = e;
    }

    var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    /**
     * An App is a collection of building blocks that all together form an application.
     * These blocks contain code, data and views that produce DOM elements.
     *
     * It is not meant to be instanciated directly, prefer using `#App.DisplayApp` instead.
     *
     * @include ../docs/app.md
     *
     * @category app, toc
     */
    class App extends Mixin {
        constructor(main_view, init_list) {
            super();
            this.main_view = main_view;
            this.init_list = init_list;
            this.registry = new App.Registry(this);
            /** @category internal */
            this.o_views = new o.Observable({});
            /**
             * The currently active blocks, ie. the blocks that were specifically
             * given to `#App.DisplayApp` or `this.activate`
             */
            this.o_active_blocks = new o.Observable(new Set());
        }
        /**
         * Activate blocks to change the application's state.
         *
         * @param params The blocks to activate, some states to put in the
         * registry already initialized to the correct values, etc.
         */
        activate(...params) {
            var blocks = params.filter(p => typeof p === 'function');
            const active = this.o_active_blocks.get();
            var not_present = false;
            for (var b of blocks) {
                if (!active.has(b))
                    not_present = true;
            }
            // do not activate if the active blocks are already activated
            if (!not_present)
                return;
            this.registry.activate(blocks);
            this.o_active_blocks.set(this.registry.active_blocks);
            this.o_views.set(this.registry.getViews());
        }
        /**
         * @internal
         */
        init() {
            // Look for a parent app. If found, pick a subregistry and register it.
            // var parent_app = App.get(this.node.parentNode!, true)
            // this.registry.setParent(parent_app ? parent_app.registry : null)
            this.activate(...this.init_list);
        }
        /**
         * @internal
         *
         * Implementation of display
         */
        display(view_name) {
            return $Display(this.o_views.tf((v, old, prev) => {
                var view = v[view_name];
                // if (sym === 'MainView')
                //   console.log(sym, v, old, o.isValue(old) && view === old[sym])
                if (o.isValue(old) && view === old[view_name] && o.isValue(prev)) {
                    return prev;
                }
                return view && view();
            }));
        }
    }
    (function (App) {
        /**
         * Display an application with the specified `#App.Block`s as activated blocks, displaying
         * the `main_view` view.
         *
         * @param main_view The name of the property holding the view to display
         * @param blocks The blocks to activate
         *
         * ```tsx
         * class LoginBlock extends App.Block {
         *   Main = this.view(() => <div>
         *     <SomeLoginForm/>
         *   </div>)
         * }
         *
         * append_child_and_mount(document.body, App.DisplayApp('Main', LoginBlock))
         * ```
         *
         * @category verb
         */
        function DisplayApp(main_view, ...blocks) {
            var app = new App(main_view, blocks);
            var disp = app.display(main_view);
            node_add_mixin(disp, app);
            return disp;
        }
        App.DisplayApp = DisplayApp;
        function view(object, key, desc) {
            var _a;
            const cons = object.constructor;
            cons.views = (_a = cons.views, (_a !== null && _a !== void 0 ? _a : {}));
            cons.views[key] = desc.value;
        }
        App.view = view;
        /**
         * A base class to make application blocks.
         *
         * A block defines views through `this.view` and reacts to
         *
         * An ObserverHolder, Blocks can use `this.observe` to watch `#o.Observable`s and will
         * only actively watch them as long as they're either *activated* or in the *requirements* of
         * an activated block.
         *
         * Blocks are meant to be used by *composition*, and not through extension.
         * Do not subclass a Block unless its state is the exact same type.
         */
        class Block extends o.ObserverHolder {
            constructor(app) {
                super();
                this.app = app;
                this.views = {};
                /** @internal */
                this.registry = this.app.registry;
                /** @internal */
                this.block_init_promise = null;
                /** @internal */
                this.block_requirements = new Set();
                this.app.registry.cache.set(this.constructor, this);
            }
            /** @internal */
            mark(s) {
                s.add(this.constructor);
                this.block_requirements.forEach(req => {
                    var proto = req.constructor;
                    if (req instanceof o.Observable) {
                        s.add(req.get().constructor);
                    }
                    if (req instanceof Block && !s.has(proto)) {
                        req.mark(s);
                    }
                    else {
                        s.add(proto);
                    }
                });
            }
            /**
             * Run `fn` on the requirements of this block, then on itself.
             *
             * @param fn The function to run on all blocks
             * @param mark A set containing blocks that were already visited
             *
             * @internal
             */
            runOnRequirementsAndSelf(fn, mark = new Set()) {
                mark.add(this);
                this.block_requirements.forEach(req => {
                    if (req instanceof Block && !mark.has(req)) {
                        req.runOnRequirementsAndSelf(fn, mark);
                    }
                });
                fn(this);
            }
            /**
             * Wait for all the required blocks to init
             * @internal
             */
            blockInit() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (this.block_init_promise) {
                        yield this.block_init_promise;
                        return;
                    }
                    var requirement_blocks = Array.from(this.block_requirements);
                    // This is where we wait for all the required blocks to end their init.
                    // Now we can init.
                    this.block_init_promise = Promise.all(requirement_blocks.map(b => b.blockInit())).then(() => this.init());
                    yield this.block_init_promise;
                    this.startObservers();
                });
            }
            /** @internal */
            blockActivate() {
                return __awaiter(this, void 0, void 0, function* () {
                    yield this.blockInit();
                    yield this.activated();
                });
            }
            /** @internal */
            blockDeinit() {
                return __awaiter(this, void 0, void 0, function* () {
                    this.stopObservers();
                    this.deinit();
                });
            }
            /**
             * Extend this method to run code whenever this block is initialized, after its requirements
             * syncInit() were run.
             */
            syncInit() { }
            /**
             * Extend this method to run code whenever the block is created after the `init()` methods
             * of the requirements have returned.
             *
             * The `init` chain is started on activation. However, the views start displaying immediately,
             * which means that in all likelyhood, `init()` for a block will terminate **after** the DOM
             * from the views was inserted.
             */
            init() {
                return __awaiter(this, void 0, void 0, function* () { });
            }
            /**
             * Extend this method to run code whenever the block is *activated* directly (ie: passed as an
             * argument to the `app.activate()` method).
             */
            activated() {
                return __awaiter(this, void 0, void 0, function* () { });
            }
            /**
             * Extend this method to run code whenever this block is removed from the app.
             *
             * A block is said to be removed from the app if it is not required by any other block.
             */
            deinit() {
                return __awaiter(this, void 0, void 0, function* () { });
            }
            /**
             * Require another block for this block to use. Mostly useful directly in the current block's
             * current properties definition.
             *
             * ```tsx
             * class MyBlock extends App.Block {
             *   // declare this block dependencies as properties
             *   auth = this.require(AuthBlock)
             *
             *   someMethod() {
             *     // since auth is now a property, I can use it as any object.
             *     console.log(this.auth.isLoggedIn())
             *   }
             * }
             * ```
             *
             * @param block_def another block's constructor
             */
            require(block_def) {
                var result = this.registry.get(block_def);
                this.block_requirements.add(result);
                return result;
            }
            /**
             * Acts as a verb that displays the specified `view_name`
             *
             * ```tsx
             * // ... inside a Block subclass declaration.
             * ToolbarView = this.view(() => <div>
             *   <h3>My Title</h3>
             *   {this.display('MoreToolbar')}
             * </div>)
             *
             * // MoreToolbar can be redefined in other blocks, which will then be displayed
             * // by app.display if they come before the current block in the requirements.
             * MoreToolbar = this.view(() => <Button click={e => doSomething()}>Something</Button>)
             * // ...
             * ```
             * @param fn
             */
            // v should be AllowedNames<this, View> ! but it is a bug with ts 3.6.2
            display(v) {
                return this.app.display(v);
            }
        }
        App.Block = Block;
        /**
         * A registry that holds types mapped to their instance.
         */
        class Registry {
            constructor(app) {
                this.app = app;
                this.cache = new Map();
                this.persistents = new Set();
                this.init_list = new Set();
                this.active_blocks = new Set();
            }
            get(key) {
                // First try to see if we own a version of this service.
                var first_attempt = this.cache.get(key);
                if (first_attempt)
                    return first_attempt;
                // If neither we nor the parent have the instance, create it ourselve.
                // We just check that the asked class/function has one argument, in which
                // case we give it the app as it *should* be a block (we do not allow
                // constructors with parameters for data services)
                var result = new key(this.app);
                if (result instanceof Block)
                    this.init_list.add(result);
                if (result.persist)
                    this.persistents.add(result);
                return result;
            }
            getViews() {
                var views = {};
                this.active_blocks.forEach(inst => {
                    var block = this.get(inst);
                    block.runOnRequirementsAndSelf(b => {
                        var _a;
                        const cons = b.constructor;
                        const v = (_a = cons.views, (_a !== null && _a !== void 0 ? _a : {}));
                        for (var key of Object.getOwnPropertyNames(v)) {
                            views[key] = v[key].bind(b);
                        }
                    });
                });
                return views;
            }
            /**
             * Activate the given blocks with the given data
             * If all the blocks were already active, then only the data will be set,
             * but the views won't be refreshed (as they're the same).
             *
             * @param blocks: The blocks to activate
             * @param data: The data to preload
             */
            activate(blocks) {
                this.active_blocks = new Set(blocks);
                var insts = Array.from(this.active_blocks).map(b => this.get(b));
                insts.forEach(i => i.blockActivate());
                this.cleanup();
                this.initPending();
            }
            /**
             * Remove entries from the registry
             */
            cleanup() {
                var mark = new Set();
                this.persistents.forEach(b => b.mark(mark));
                this.active_blocks.forEach(bl => {
                    var b = this.cache.get(bl);
                    b.mark(mark);
                });
                // now, we sweep
                this.cache.forEach((value, key) => {
                    if (!mark.has(key)) {
                        this.cache.delete(key);
                        value.blockDeinit();
                    }
                });
            }
            initPending() {
                for (var block of this.init_list) {
                    this.init_list.delete(block);
                    block.blockInit();
                }
            }
        }
        App.Registry = Registry;
    })(App || (App = {}));

    exports.$Display = $Display;
    exports.$Fragment = $Fragment;
    exports.$If = $If;
    exports.$Repeat = $Repeat;
    exports.$RepeatScroll = $RepeatScroll;
    exports.$Switch = $Switch;
    exports.$class = $class;
    exports.$click = $click;
    exports.$id = $id;
    exports.$init = $init;
    exports.$inserted = $inserted;
    exports.$observe = $observe;
    exports.$on = $on;
    exports.$props = $props;
    exports.$removed = $removed;
    exports.$scrollable = $scrollable;
    exports.$style = $style;
    exports.$title = $title;
    exports.App = App;
    exports.CommentContainer = CommentContainer;
    exports.Component = Component;
    exports.Displayer = Displayer;
    exports.Mixin = Mixin;
    exports.append_child_and_init = append_child_and_init;
    exports.e = e;
    exports.get_node_from_insertable = get_node_from_insertable;
    exports.insert_before_and_init = insert_before_and_init;
    exports.node_add_event_listener = node_add_event_listener;
    exports.node_add_mixin = node_add_mixin;
    exports.node_do_init = node_do_init;
    exports.node_do_inserted = node_do_inserted;
    exports.node_do_remove = node_do_remove;
    exports.node_is_inited = node_is_inited;
    exports.node_is_inserted = node_is_inserted;
    exports.node_is_observing = node_is_observing;
    exports.node_observe = node_observe;
    exports.node_observe_attribute = node_observe_attribute;
    exports.node_observe_class = node_observe_class;
    exports.node_observe_style = node_observe_style;
    exports.node_off = node_off;
    exports.node_on = node_on;
    exports.node_remove_after = node_remove_after;
    exports.node_remove_mixin = node_remove_mixin;
    exports.node_unobserve = node_unobserve;
    exports.o = o;
    exports.remove_and_deinit = remove_and_deinit;
    exports.setup_mutation_observer = setup_mutation_observer;
    exports.sym_init = sym_init;
    exports.sym_inserted = sym_inserted;
    exports.sym_mixins = sym_mixins;
    exports.sym_mount_status = sym_mount_status;
    exports.sym_observers = sym_observers;
    exports.sym_removed = sym_removed;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=elt.js.map
