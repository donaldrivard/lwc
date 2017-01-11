const PUBLIC_METHOD_DECORATOR = 'method';
const UNKNOWN_NAMESPACE = 'unknown';

module.exports = function (babel) {
    'use strict';
    const t = babel.types;

    function addClassStaticMember(identifier, prop, blockStatement) {
        return t.expressionStatement(
            t.assignmentExpression(
                '=',
                t.memberExpression(identifier, t.identifier(prop)),
                blockStatement
            )
        );
    }

    function transformClassBody(identifier, classBodyPath, state) {
        const classBody = classBodyPath.get('body');
        const className = identifier.name;
        const publicProps = [];
        const publicMethods = [];
        const extraBody = [];
        for (let prop of classBody) {
            // Props
            if (prop.isClassProperty()) {
                // Remove decorators for now
                if (prop.node.decorators) {
                    prop.node.decorators = null;
                }
                // Throw if we find `this`. (needs refinement)
                prop.traverse({
                    ThisExpression() {
                        throw new Error('Reference to the instance is now allowed in class properties');
                    }
                });

                let value = prop.node.value || t.nullLiteral();
                if (!t.isLiteral(value) && !t.isIdentifier(value)) {
                    value = t.functionExpression(null, [], t.blockStatement([t.returnStatement(value)]));
                }

                publicProps.push(t.objectProperty(t.identifier(prop.node.key.name), value));
                prop.remove();

            } else if (prop.isClassMethod({
                    kind: 'method'
                }) && prop.node.decorators) {
                if (prop.node.decorators[0].expression.name === PUBLIC_METHOD_DECORATOR) {
                    publicMethods.push(prop.node.key.name);
                }

                prop.node.decorators = null;
            }
        }

        const isEntryClass = false;
        const prefix = isEntryClass ? '' : 'private-';
        const tagName = (`${state.opts.componentNamespace}-${prefix}${className}`).toLowerCase();

        extraBody.push(addClassStaticMember(identifier, 'tagName', t.stringLiteral(tagName)));

        if (publicProps.length) {
            extraBody.push(addClassStaticMember(identifier, 'publicProps', t.objectExpression(publicProps)));
        }

        if (publicMethods.length) {
            extraBody.push(addClassStaticMember(identifier, 'publicMethods', t.valueToNode(publicMethods)));
        }

        return extraBody;
    }

    return {
        name: 'raptor-class',
        pre() {
            this.compiledClasses = {};
        },
        visitor: {
            Program: {
                enter(path, state) {
                    const body = path.node.body;
                    const exportD = body.find(n => t.isExportDefaultDeclaration(n));
                    if (!exportD) {
                        throw path.buildCodeFrameError("This module needs to export a default class");
                    }

                    const decl = exportD.declaration;

                    if (t.isClassDeclaration(decl) && decl.id) { 
                        // Override the name if you explicitly export a named class
                        state.opts.componentName = decl.id.name || state.opts.componentName;
                    }

                    state.opts.componentNamespace = state.opts.componentNamespace || UNKNOWN_NAMESPACE;
                },
                exit(path, state) {
                    if(state.opts.componentName && !this.entryClass) {
                        throw path.buildCodeFrameError("Class name does not match the current bundle entry point");
                    }
                    if (this.entryClass && Object.keys(this.compiledClasses) > 1 && this.compiledClasses[state.opts.componentName]) {
                        throw path.buildCodeFrameError("Ambiguity locating the class entry point");
                    }
                }

            },
            ClassDeclaration(path, state) {
                const className = path.node.id.name;
              /*
                if (!className) {
                    throw path.buildCodeFrameError("For debugability purposes we don't allow anonymous classes");
                }

                const extraBody = transformClassBody.call(this, className, path.get('body'), state);
                this.compiledClasses[className.toLowerCase()] = true;

                if (path.inList) {
                    path.insertAfter(extraBody);
                } else {
                    const root = path.findParent((p) => p.isProgram());
                    root.pushContainer('body', extraBody);
                }
                */
            },
            ClassExpression(path, state) {
              const classBody = path.get('body'); 
              const parent = path.parentPath;
              const parentStatement = path.getStatementParent(); 
              let identifierNode;
              
              if (!parent.isVariableDeclarator()) {
                const id = path.scope.generateUidIdentifierBasedOnNode(path.node.id);
                path.replaceWith(id);
                
                parentStatement.insertBefore([t.variableDeclaration('var', [t.variableDeclarator(id, path.node)])]);
	            parentStatement.insertBefore(transformClassBody.call(this, id, classBody, state));

              } else {

              }
            }
        }
    };
}