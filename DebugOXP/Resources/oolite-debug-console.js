/*

oolite-debug-console.js

JavaScript section of JavaScript console implementation.

This script is attached to a one-off JavaScript object of type Console, which
represents the Objective-C portion of the implementation. Commands entered
into the console are passed to this script’s consolePerformJSCommand()
function. Since console commands are performed within the context of this
script, they have access to any functions in this script. You can therefore
add debugger commands using a customized version of this script.

The following properties are predefined for the script object:
	console: the console object.

The console object has the following properties and methods:

debugFlags : Number (integer, read/write)
	An integer bit mask specifying various debug options. The flags vary
	between builds, but at the time of writing they are:
		console.DEBUG_LINKED_LISTS
		console.DEBUG_COLLISIONS
		console.DEBUG_DOCKING
		console.DEBUG_OCTREE_LOGGING
		console.DEBUG_BOUNDING_BOXES
		console.DEBUG_OCTREE_DRAW
		console.DEBUG_DRAW_NORMALS
		console.DEBUG_NO_DUST
		console.DEBUG_NO_SHADER_FALLBACK
		console.DEBUG_SHADER_VALIDATION
		
	The current flags can be seen in OODebugFlags.h in the Oolite source code,
	for instance at:
		http://svn.berlios.de/svnroot/repos/oolite-linux/trunk/src/Core/Debug/OODebugFlags.h
		
	For example, to enable rendering of bounding boxes and surface normals,
	you might use:
		console.debugFlags ^= console.DEBUG_BOUNDING_BOXES
		console.debugFlags ^= console.DEBUG_DRAW_NORMALS
	
	Explaining bitwise operations is beyond the scope of this comment, but
	the ^= operator (XOR assign) can be thought of as a “toggle option”
	command.

shaderMode : String (read/write)
	A string specifying the current shader mode. One of the following:
		"SHADERS_NOT_SUPPORTED"
		"SHADERS_OFF"
		"SHADERS_SIMPLE"
		"SHADERS_FULL"
	If it is SHADERS_NOT_SUPPORTED, it cannot be set to any other value. If it
	is not SHADERS_NOT_SUPPORTED, it can be set to SHADERS_OFF, SHADERS_SIMPLE
	or SHADERS_FULL, unless maximumShaderMode (see below) is SHADERS_SIMPLE,
	in which case SHADERS_FULL is not allowed.
	
	NOTE: this is equivalent to oolite.gameSettings.shaderEffectsLevel, which
	is available even when the debug console is not active, but is read-only.

maximumShaderMode: String (read-only)
	A string specifying the fanciest available shader mode. One of the following:
		"SHADERS_NOT_SUPPORTED"
		"SHADERS_SIMPLE"
		"SHADERS_FULL"

reducedDetailMode: Boolean (read/write)
	Whether reduced detail mode is in effect (simplifies graphics in various
	different ways).

displayFPS : Boolean (read/write)
	Boolean specifying whether FPS (and associated information) should be
	displayed.
 
glVendorString : String (read-only)
glRendererString : String (read-only)
	Information about the OpenGL renderer.

platformDescription : String (read-only)
	Information about the system Oolite is running on. The format of this
	string is not guaranteed, do not attempt to parse it.

	
function consoleMessage(colorCode : String, message : String [, emphasisStart : Number, emphasisLength : Number])
	Similar to log(), but takes a colour code which is looked up in
	debugConfig.plist. null is equivalent to "general". It can also optionally
	take a range of characters that should be emphasised.

function clearConsole()
	Clear the console.

function inspectEntity(entity : Entity)
	Show inspector palette for entity (Mac OS X only).

function displayMessagesInClass(class : String) : Boolean
	Returns true if the specified log message class is enabled, false otherwise.

function setDisplayMessagesInClass(class : String, flag : Boolean)
	Enable or disable logging of the specified log message class. For example,
	the equivalent of the legacy command debugOn is:
		debugConsole.setDisplayMessagesInClass("$scriptDebugOn", true);
	Metaclasses and inheritance work as in logcontrol.plist.
	
function isExecutableJavaScript(code : String) : Boolean
	Used to test whether code is runnable as-is. Returns false if the code has
	unbalanced braces or parentheses. (Used in consolePerformJSCommand() below.)

function profile(func : function [, this : Object]) : String
	Time the specified function, report the time spent in various Oolite
	functions and how much time is excluded from the time limiter mechanism.
	NOTE: while profile() is running, the time limiter is effectively disabled
	(specifically, it's set to ten million seconds).

function getProfile(func : function [, this : Object]) : Object
	Like profile(), but returns an object, which is more amenable to processing
	in scripts. To see the structure of the object, run:
	  console.getProfile(function(){PS.position.add([0, 0, 0])}).callObjC("description")

function writeLogMarker()
	Writes a separator to the log.


Useful properties of the console script (which can be used directly in the
console, e.g. “log($)”):

$
	The value of the last interesting (non-null, non-undefined) value evaluated
	by the console. This includes values generated by macros.

result
	Set by some macros, such as :find.


Oolite Debug OXP

Copyright © 2007-2010 Jens Ayton

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

this.name			= "oolite-debug-console";
this.author			= "Jens Ayton";
this.copyright		= "© 2007-2010 the Oolite team.";
this.description	= "Debug console script.";
this.version		= "1.75";


this.inputBuffer	= "";
this.$				= null;


// **** Macros

// Normally, these will be overwritten with macros from the config plist.
this.macros =
{
	setM:		"setMacro(PARAM)",
	delM:		"deleteMacro(PARAM)",
	showM:		"showMacro(PARAM)"
};


// ****  Convenience functions -- copy this script and add your own here.

// List the enumerable properties of an object.
this.dumpObjectShort = function dumpObjectShort(x)
{
	consoleMessage("dumpObject", x.toString() + ":");
	for (var prop in x)
	{
		if (prop.hasOwnProperty(name))
		{
			consoleMessage("dumpObject", "    " + prop);
		}
	}
}


this.performLegacyCommand = function performLegacyCommand(x)
{
	var [command, params] = x.getOneToken();
	return player.ship.callObjC(command, params);
}


// List the enumerable properties of an object, and their values.
this.dumpObjectLong = function dumpObjectLong(x)
{
	consoleMessage("dumpObject", x.toString() + ":");
	for (var prop in x)
	{
		if (prop.hasOwnProperty(name))
		{
			consoleMessage("dumpObject", "    " + prop + " = " + x[prop]);
		}
	}
}


// Print the objects in a list on lines.
this.printList = function printList(l)
{
	var length = l.length;
	
	consoleMessage("printList", length.toString() + " items:");
	for (var i = 0; i != length; i++)
	{
		consoleMessage("printList", "  " + l[i].toString());
	}
}


this.setColorFromString = function setColorFromString(string, typeName)
{ 
	// Slice of the first component, where components are separated by one or more spaces.
	var [key, value] = string.getOneToken();
	var fullKey = key + "-" + typeName + "-color";
	
	/*	Set the colour. The "var c" stuff is so that JS property lists (like
		{ hue: 240, saturation: 0.12 } will work -- this syntax is only valid
		in assignments.
	*/
	debugConsole.settings[fullKey] = eval("var c=" + value + ";c");
	
	consoleMessage("command-result", "Set " + typeName + " colour “" + key + "” to " + value + ".");
}


// ****  Conosole command handler

this.consolePerformJSCommand = function consolePerformJSCommand(command)
{
	var originalCommand = command;
	while (command.charAt(0) == " ")
	{
		command = command.substring(1);
	}
	while (command.length > 1 && command.charAt(command.length - 1) == "\n")
	{
		command = command.substring(0, command.length - 1);
	}
	
	if (command.charAt(0) != ":")
	{
		// No colon prefix, just JavaScript code.
		// Append to buffer, then run if runnable or empty line.
		this.inputBuffer += "\n" + originalCommand;
		if (command == "" || debugConsole.isExecutableJavaScript(debugConsole, this.inputBuffer))
		{
			// Echo input to console, emphasising the command itself.
			consoleMessage("command", "> " + command, 2, command.length);
			
			command = this.inputBuffer;
			this.inputBuffer = "";
			this.evaluate(command, "command");
		}
		else
		{
			// Echo input to console, emphasising the command itself.
			consoleMessage("command", "_ " + command, 2, command.length);
		}
	}
	else
	{
		// Echo input to console, emphasising the command itself.
		consoleMessage("command", "> " + command, 2, command.length);
		
		// Colon prefix, this is a macro.
		this.performMacro(command);
	}
}


this.evaluate = function evaluate(command, type, PARAM)
{
	var result = eval(command);
	if (result !== undefined)
	{
		if (result === null)  result = "null";
		else  this.$ = result;
		consoleMessage("command-result", result.toString());
	}
}


// ****  Macro handling

this.setMacro = function setMacro(parameters)
{
	if (!parameters)  return;
	
	// Split at first series of spaces
	var [name, body] = parameters.getOneToken();
	
	if (body)
	{
		macros[name] = body;
		debugConsole.settings["macros"] = macros;
		
		consoleMessage("macro-info", "Set macro :" + name + ".");
	}
	else
	{
		consoleMessage("macro-error", "setMacro(): a macro definition must have a name and a body.");
	}
}


this.deleteMacro = function deleteMacro(parameters)
{
	if (!parameters)  return;
	
	var [name, ] = parameters.getOneToken();
	
	if (name.charAt(0) == ":" && name != ":")  name = name.substring(1);
	
	if (macros[name])
	{
		delete macros[name];
		debugConsole.settings["macros"] = macros;
		
		consoleMessage("macro-info", "Deleted macro :" + name + ".");
	}
	else
	{
		consoleMessage("macro-info", "Macro :" + name + " is not defined.");
	}
}


this.showMacro = function showMacro(parameters)
{
	if (!parameters)  return;
	
	var [name, ] = parameters.getOneToken();
	
	if (name.charAt(0) == ":" && name != ":")  name = name.substring(1);
	
	if (macros[name])
	{
		consoleMessage("macro-info", ":" + name + " = " + macros[name]);
	}
	else
	{
		consoleMessage("macro-info", "Macro :" + name + " is not defined.");
	}
}


this.performMacro = function performMacro(command)
{
	if (!command)  return;
	
	// Strip the initial colon
	command = command.substring(1);
	
	// Split at first series of spaces
	var [macroName, parameters] = command.getOneToken();
	if (macros[macroName] !== undefined)
	{
		var expansion = macros[macroName];
		
		if (expansion)
		{
			// Show macro expansion.
			var displayExpansion = expansion;
			if (parameters)
			{
				// Substitute parameter string into display expansion, going from 'foo(PARAM)' to 'foo("parameters")'.
				displayExpansion = displayExpansion.replace(/PARAM/g, '"' + parameters.substituteEscapeCodes() + '"');
			}
			consoleMessage("macro-expansion", "> " + displayExpansion);
			
			// Perform macro.
			this.evaluate(expansion, "macro", parameters);
		}
	}
	else
	{
		consoleMessage("unknown-macro", "Macro :" + macroName + " is not defined.");
	}
}


// ****  Utility functions

/*
	Split a string at the first sequence of spaces, returning an array with
	two elements. If there are no spaces, the first element of the result will
	be the input string, and the second will be null. Leading spaces are
	stripped. Examples:
	
	"x y"   -->  ["x", "y"]
	"x   y" -->  ["x", "y"]
	"  x y" -->  ["x", "y"]
	"xy"    -->  ["xy", null]
	" xy"   -->  ["xy", null]
	""      -->  ["", null]
	" "     -->  ["", null]
 */
String.prototype.getOneToken = function getOneToken()
{
	var matcher = /\s+/g;		// Regular expression to match one or more spaces.
	matcher.lastIndex = 0;
	var match = matcher.exec(this);
	
	if (match)
	{
		var token = this.substring(0, match.index);		// Text before spaces
		var tail = this.substring(matcher.lastIndex);	// Text after spaces
		
		if (token.length != 0)  return [token, tail];
		else  return tail.getOneToken();	// Handle leading spaces case. This won't recurse more than once.
	}
	else
	{
		// No spaces
		return [this, null];
	}
}



/*
	Replace special characters in string with escape codes, for displaying a
	string literal as a JavaScript literal. (Used in performMacro() to echo
	macro expansion.)
 */
String.prototype.substituteEscapeCodes = function substituteEscapeCodes()
{
	var string = this.replace(/\\/g, "\\\\");	// Convert \ to \\ -- must be first since we’ll be introducing new \s below.
	
	string = string.replace(/\x08/g, "\\b");	// Backspace to \b
	string = string.replace(/\f/g, "\\f");		// Form feed to \f
	string = string.replace(/\n/g, "\\n");		// Newline to \n
	string = string.replace(/\r/g, "\\r");		// Carriage return to \r
	string = string.replace(/\t/g, "\\t");		// Horizontal tab to \t
	string = string.replace(/\v/g, "\\v");		// Vertical ab to \v
	string = string.replace(/\'/g, '\\\'');		// ' to \'
	string = string.replace(/\"/g, "\\\"");		// " to \"

	return string;
}


// ****  Load-time set-up

// Make console globally visible as debugConsole
global.debugConsole = this.console;
debugConsole.script = this;

if (debugConsole.settings["macros"])  this.macros = debugConsole.settings["macros"];

/*	As a convenience, make player, player.ship, system and missionVariables
	available to console commands as short variables:
*/
this.P = player;
this.PS = player.ship;
this.S = system;
this.M = missionVariables;


// Make console.consoleMessage() globally visible
function consoleMessage()
{
	// Call debugConsole.consoleMessage() with console as "this" and all the arguments passed to consoleMessage().
	debugConsole.consoleMessage.apply(debugConsole, arguments);
}


// Add inspect() method to all entities, to show inspector palette (Mac OS X only; no effect on other platforms).
Entity.inspect = function inspect()
{
	debugConsole.inspectEntity(this);
}


debugConsole.__setUpCallObjC(Object.prototype);
