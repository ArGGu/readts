// This file is part of readts, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as ts from 'typescript';
import * as readts from './readts';

/** Hooks to change how parts of type definitions are converted to strings. */

export interface FormatHooks {
	[name: string]: (spec: TypeSpec, hooks: FormatHooks) => string;

	class?: (spec: TypeSpec, hooks: FormatHooks) => string;
	array?: (spec: TypeSpec, hooks: FormatHooks) => string;
	union?: (spec: TypeSpec, hooks: FormatHooks) => string;
}

/** Type definition. */

export class TypeSpec {
	/** Parse a type from TypeScript services. @ignore internal use. */

	constructor(type: ts.Type, parser: readts.Parser) {
		var tf = ts.TypeFlags;

		// console.log(Object.keys(tf).map((name: string) => type.flags & tf[name] ? name : null).filter((name) => !!name).join(' | '));

		if(type.flags & ((tf as any).Intrinsic | tf.ThisType | tf.Anonymous | tf.StringLiteral)) {
			this.name = parser.typeToString(type);
		} else if(type.flags & tf.Reference) {
			this.parseReference(type as ts.TypeReference, parser);
		} else if (type.flags & (tf.Class | tf.Interface | tf.Enum | tf.TypeParameter)) {
			this.parseClass(type, parser);
		} else if (type.flags & tf.Tuple) {
		} else if (type.flags & tf.UnionOrIntersection) {
			this.parseUnion(type as ts.UnionOrIntersectionType, parser);
		}
	}

	private parseClass(type: ts.Type, parser: readts.Parser) {
		var spec = parser.getSymbol(type.symbol);

		if(spec) this.class = spec;
		else this.name = parser.typeToString(type);
	}

	private parseReference(type: ts.TypeReference, parser: readts.Parser) {
		// Hack to recognize arrays, TypeScript services doesn't seem to export
		// the array symbol it uses internally to detect array types
		// so just check the name.
		if(type.target.symbol.getName() == 'Array' && type.typeArguments) {
			this.arrayOf = new TypeSpec(type.typeArguments[0], parser);
		} else this.parseClass(type, parser);
	}

	private parseUnion(type: ts.UnionOrIntersectionType, parser: readts.Parser) {
		this.unionOf = type.types.map((type: ts.Type) => new TypeSpec(type, parser));
	}

	/** Convert to string, with optional hooks replacing default formatting code. */

	format(hooks?: FormatHooks, needParens?: boolean): string {
		if(this.name) return(this.name);
		if(this.class) return(hooks && hooks.class ? hooks.class(this, hooks) : this.class.name);
		if(this.arrayOf) return(hooks && hooks.array ? hooks.array(this, hooks) : this.arrayOf.format(hooks, true) + '[]');

		var output: string;

		if(this.unionOf) output = hooks && hooks.union ? hooks.union(this, hooks) : this.unionOf.map((spec: TypeSpec) => spec.format(hooks, true)).join(' | ');

		if(needParens) output = '(' + output + ')';

		return(output);
	}

	/** Name of the type, only present if not composed of other type or class etc. */
	name: string;
	/** If the type refers to a class, its definition. */
	class: readts.ClassSpec;
	/** If the type is a union, list of the possible types. */
	unionOf: TypeSpec[];
	/** If the type is an array, its element type. */
	arrayOf: TypeSpec;
}
