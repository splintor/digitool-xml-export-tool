digitool-xml-export-tool is a tool to export data from XML files exported from Ex Libris DigiTool into CSV format.

It uses nodes.js (https://nodejs.org), and requires installation of shelljs node module (using "npm install shelljs").

Tool usage:
	node export-digitool-xml.js [-s <source>] [-o <output CSV file>]

	source can be either an xml file, a directory that contains xml files, or a zip file that contains xml files.