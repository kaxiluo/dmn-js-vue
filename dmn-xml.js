window.DmnXml = DmnXml

function DmnXml() {
}

DmnXml.getEmptyXml = function () {
    let id = "Definitions_app" + Math.random().toString(36).slice(2)
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<definitions xmlns=\"https://www.omg.org/spec/DMN/20191111/MODEL/\"\n" +
        "             xmlns:dmndi=\"https://www.omg.org/spec/DMN/20191111/DMNDI/\"\n" +
        "             xmlns:dc=\"http://www.omg.org/spec/DMN/20180521/DC/\" \n" +
        "             xmlns:camunda=\"http://camunda.org/schema/1.0/dmn\"\n" +
        "             xmlns:di=\"http://www.omg.org/spec/DMN/20180521/DI/\"\n" +
        "             id=\"" + id + "\"\n" +
        "             name=\"DRD\" namespace=\"http://camunda.org/schema/1.0/dmn\"\n" +
        "             exporter=\"Camunda Modeler\" exporterVersion=\"4.11.1\">\n" +
        "</definitions>";
}

DmnXml.getXmlByAttributes = function (oldXml, attributes) {
    return DmnXmlTemplate.getXml(oldXml, attributes)
}


class DmnXmlTemplate {
    static ShapeHeight = 80

    static ShapeWidth = 180

    static DefaultOutputLabel = '得分'

    static DefaultOutputType = 'number'

    static getXml(oldXml, attributes) {
        if (attributes.length === 0) {
            return DmnXml.getEmptyXml()
        }
        if (!oldXml) {
            oldXml = DmnXml.getEmptyXml()
        }

        // 输入属性预处理
        let allCodes = []
        let attributeMap = []
        for (let k in attributes) {
            allCodes.push(attributes[k].code)
            attributeMap[attributes[k].code] = attributes[k]
        }
        allCodes = Array.from(new Set(allCodes));

        // load xml
        let xmlDoc = loadXmlString(oldXml)

        // 解析每个decision
        let decisionNodes = xmlDoc.getElementsByTagName('decision')
        let hitCodes = [] //xml中已包含的属性
        let removeDecisionIds = []
        let decisionItems = []
        for (let i = 0; i < decisionNodes.length; i++) {
            let item = this._parseDecision(decisionNodes.item(i), allCodes)
            if (item.codes.length === 0) {
                removeDecisionIds.push(item.id)
            } else {
                decisionItems.push(item)
                hitCodes.push(...item.codes)
            }
        }

        // 无有效属性 或 求和，移除节点
        removeDecisionIds.forEach(function (v) {
            xmlDoc.getElementById(v).remove()
        })

        // 求差集，得出没有命中的code
        let missCodes = []
        hitCodes = hitCodes ? [...new Set(hitCodes)] : [];
        allCodes.forEach(function (v) {
            if (hitCodes.indexOf(v) === -1) {
                missCodes.push(v)
            }
        })

        // 新建decision
        for (let k in missCodes) {
            let item = this._createDecision(xmlDoc, attributeMap[missCodes[k]])
            decisionItems.push(item)
        }

        // 多个decision，需要添加一个求和节点
        let totalDecisionItem = {}
        if (decisionItems.length > 1) {
            totalDecisionItem = this._createTotalDecision(xmlDoc, decisionItems)
        }

        // 重新创建图像，连线节点
        this._reCreateDMNDI(xmlDoc, decisionItems, totalDecisionItem)

        let newXml = xmlDomToString(xmlDoc)
        return newXml.replace(/xmlns=""/g, '')
    }

    // 解析单个decision（非求和节点）
    static _parseDecision(decisionNode, allCodes) {
        let data = { codes: [], output: "", id: "" }
        // 有效codes
        let codes = []
        let inputNodes = decisionNode.getElementsByTagName('input')
        for (let i = 0; i < inputNodes.length; i++) {
            let inputNode = inputNodes.item(i)
            // only dmn-js < 12.0.0
            let code = inputNode.getAttribute('camunda:inputVariable')
            if (code && allCodes.indexOf(code) !== -1) {
                codes.push(code)
            }
        }
        data.codes = codes
        // 输出变量名
        let output = decisionNode.getElementsByTagName('output')
        if (output.length) {
            data.output = output.item(0).getAttribute('name')
        }
        data.id = decisionNode.getAttribute('id')
        return data
    }

    // 新增decision
    static _createDecision(xmlDoc, attribute) {
        let random = Math.random().toString(36).slice(2)
        let name = attribute.name
        let code = attribute.code
        let type = this._codeTypeTrans(attribute.type)
        let id = "Definitions_hrs" + random
        let outputVar = "output_" + code

        let decision = xmlDoc.createElement('decision')
        decision.setAttribute('id', id)
        decision.setAttribute('name', name)
        let decisionTable = xmlDoc.createElement('decisionTable')
        decisionTable.setAttribute('id', "DecisionTable_" + random)
        decision.appendChild(decisionTable)// decisionTable
        let input = xmlDoc.createElement('input')
        input.setAttribute('id', "Input_" + code)
        input.setAttribute('label', name)
        input.setAttribute('camunda:inputVariable', code)
        decisionTable.appendChild(input) // input
        let inputExpression = xmlDoc.createElement('inputExpression')
        inputExpression.setAttribute('id', "InputExpression_" + code)
        inputExpression.setAttribute('typeRef', type)
        input.appendChild(inputExpression) // inputExpression
        let text = xmlDoc.createElement('text')
        inputExpression.appendChild(text) // text
        let output = xmlDoc.createElement('output')
        output.setAttribute('id', "Output_" + code)
        output.setAttribute('label', this.DefaultOutputLabel)
        output.setAttribute('name', outputVar)
        output.setAttribute('typeRef', this.DefaultOutputType)
        decisionTable.appendChild(output) // output

        xmlDoc.documentElement.appendChild(decision)
        return { codes: [code], output: outputVar, id: id }
    }

    static _createTotalDecision(xmlDoc, decisionItems) {
        let random = Math.random().toString(36).slice(2)
        let id = "Definitions_hrt" + random
        let outputVar = "output"

        let decision = xmlDoc.createElement('decision')
        decision.setAttribute('id', id)
        decision.setAttribute('name', '求和')
        let variable = xmlDoc.createElement('variable')
        variable.setAttribute('id', "InformationItem_" + random)
        variable.setAttribute('name', outputVar)
        variable.setAttribute('typeRef', this.DefaultOutputType)
        decision.appendChild(variable)

        let outputVars = []
        let informationRequirementIds = []
        // informationRequirement
        decisionItems.forEach(function (item, k) {
            let informationRequirementId = 'InformationRequirement_' + k + random
            let informationRequirement = xmlDoc.createElement('informationRequirement')
            informationRequirement.setAttribute('id', informationRequirementId)
            let requiredDecision = xmlDoc.createElement('requiredDecision')
            requiredDecision.setAttribute('href', "#" + item.id)
            informationRequirement.appendChild(requiredDecision)
            decision.appendChild(informationRequirement)
            outputVars.push(item.output)
            informationRequirementIds.push(informationRequirementId)
        })
        let literalExpression = xmlDoc.createElement('literalExpression')
        literalExpression.setAttribute('id', "LiteralExpression_" + random)
        literalExpression.setAttribute('expressionLanguage', 'feel')
        let text = xmlDoc.createElement('text')
        text.appendChild(xmlDoc.createTextNode(outputVars.join(' + ')));
        literalExpression.appendChild(text)
        decision.appendChild(literalExpression)

        xmlDoc.documentElement.appendChild(decision)
        return { id: id, output: outputVar, informationRequirementIds: informationRequirementIds }
    }

    static _reCreateDMNDI(xmlDoc, decisionItems, totalDecisionItem) {
        let oldDmndi = xmlDoc.getElementsByTagName('dmndi:DMNDI')
        if (oldDmndi.length) {
            oldDmndi.item(0).remove()
        }
        let DMNDI = xmlDoc.createElement('dmndi:DMNDI')
        let DMNDiagram = xmlDoc.createElement('dmndi:DMNDiagram')
        DMNDI.appendChild(DMNDiagram)

        let beginX = 160
        let spacingX = 20
        let beginY = 100
        let spacingY = 100

        // decision图形
        let x;
        let y;
        for (let i = 0; i < decisionItems.length; i++) {
            x = beginX + (this.ShapeWidth + spacingX) * i;
            y = beginY + this.ShapeHeight + spacingY;
            let DMNShape = this._makeDMNShape(xmlDoc, decisionItems[i], x, y)
            DMNDiagram.appendChild(DMNShape)
        }

        // total decision图形
        if (totalDecisionItem.id) {
            let totalX = beginX + ((this.ShapeWidth + spacingX) * decisionItems.length - spacingX) / 2 - this.ShapeWidth / 2;
            let DMNShape = this._makeDMNShape(xmlDoc, totalDecisionItem, totalX, beginY)
            DMNDiagram.appendChild(DMNShape)
            // 连线
            for (let j = 0; j < totalDecisionItem.informationRequirementIds.length; j++) {
                let DMNEdge = xmlDoc.createElement('dmndi:DMNEdge')
                DMNEdge.setAttribute('id', "DMNEdge_" + Math.random().toString(36).slice(2))
                DMNEdge.setAttribute('dmnElementRef', totalDecisionItem.informationRequirementIds[j])
                DMNDiagram.appendChild(DMNEdge)
                // 连线的点
                let points = [
                    {
                        x: beginX + (this.ShapeWidth + spacingX) * j + this.ShapeWidth / 2,
                        y: beginY + this.ShapeHeight + spacingY,
                    },
                    {
                        x: totalX + ((this.ShapeWidth / (decisionItems.length - 1))) * j,
                        y: beginY + this.ShapeHeight,
                    }
                ]
                points.forEach(function (point) {
                    let waypoint = xmlDoc.createElement('di:waypoint')
                    waypoint.setAttribute('x', point.x)
                    waypoint.setAttribute('y', point.y)
                    DMNEdge.appendChild(waypoint)
                })
            }
        }

        xmlDoc.documentElement.appendChild(DMNDI)
    }

    static _makeDMNShape(xmlDoc, decisionItem, x, y) {
        let DMNShape = xmlDoc.createElement('dmndi:DMNShape')
        DMNShape.setAttribute('id', "DMNShape_" + Math.random().toString(36).slice(2))
        DMNShape.setAttribute('dmnElementRef', decisionItem.id)
        let dcBounds = xmlDoc.createElement('dc:Bounds')
        dcBounds.setAttribute('height', this.ShapeHeight)
        dcBounds.setAttribute('width', this.ShapeWidth)
        dcBounds.setAttribute('x', x)
        dcBounds.setAttribute('y', y)
        DMNShape.appendChild(dcBounds)
        return DMNShape
    }
    // 变量类型兼容
    static _codeTypeTrans(codeType) {
        let type
        switch (codeType) {
            case 'int':
                type = 'integer'
                break
            case 'float':
                type = 'double'
                break
            case 'bool':
                type = 'boolean'
                break
            case 'text':
                type = 'string'
                break
            case 'datetime':
                type = 'dateTime'
                break
            case 'decimal':
                type = 'number'
                break
            default:
                type = codeType
        }
        return type
    }
}

function loadXmlString(xmlStr) {
    try {
        xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        xmlDoc.async = false;
        xmlDoc.loadXML(xmlStr);
        return xmlDoc;
    } catch (e) {
        try {
            return new DOMParser().parseFromString(xmlStr, "text/xml");
        } catch (e) {
            alert(e.message())
            return null
        }
    }
}

function xmlDomToString(xmlObj) {
    if (xmlObj.xml) {
        return xmlObj.xml
    } else {
        return (new XMLSerializer()).serializeToString(xmlObj);
    }
}

// 辅助公式
DmnXml.formulas = [
    // case 1: 每次n分
    {
        id: 1,
        name: '每次扣n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: ">0", output: "-code * {n}" }, { condition: "<=0", output: "0" }]
    },
    {
        id: 1.1,
        name: '每次加n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'add',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: ">0", output: "code * {n}" }, { condition: "<=0", output: "0" }]
    },
    {
        id: 1.2,
        name: '每次扣该项基础分%n',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: ">0", output: "-code*{n}*0.01*base_score" }, { condition: "<=0", output: "0" }]
    },
    // case 2: bool
    {
        id: 2,
        name: '有该情况扣n分',
        allowAttributeCodeTypes: ["bool", "boolean"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: "true", output: "-{n}" }, { condition: "false", output: "0" }]
    },
    {
        id: 2.1,
        name: '有该情况加n分',
        allowAttributeCodeTypes: ["bool", "boolean"],
        operate: 'add',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: "true", output: "{n}" }, { condition: "false", output: "0" }]
    },
    {
        id: 2.2,
        name: '没有该情况扣n分',
        allowAttributeCodeTypes: ["bool", "boolean"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: "false", output: "-{n}" }, { condition: "true", output: "0" }]
    },
    {
        id: 2.3,
        name: '没有该情况加n分',
        allowAttributeCodeTypes: ["bool", "boolean"],
        operate: 'add',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: "false", output: "{n}" }, { condition: "true", output: "0" }]
    },
    {
        id: 2.4,
        name: '有该情况扣该项基础分%n',
        allowAttributeCodeTypes: ["bool", "boolean"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: 100 }],
        rules: [{ condition: "true", output: "-{n}*0.01*base_score" }, { condition: "false", output: "0" }]
    },
    {
        id: 2.5,
        name: '没有该情况扣该项基础分%n',
        allowAttributeCodeTypes: ["bool", "boolean"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: 100 }],
        rules: [{ condition: "false", output: "-{n}*0.01*base_score" }, { condition: "true", output: "0" }]
    },
    // case 3: m次 n分
    {
        id: 3,
        name: '低于m次扣n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: "<{m}", output: "-{n}" }, { condition: ">={m}", output: "0" }]
    },
    {
        id: 3.1,
        name: '超过m次扣n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: ">{m}", output: "-{n}" }, { condition: "<={m}", output: "0" }]
    },
    {
        id: 3.2,
        name: '超过m次加n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'add',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: ">{m}", output: "{n}" }, { condition: "<={m}", output: "0" }]
    },
    {
        id: 3.3,
        name: '低于m次，低的部分每次扣n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: "<{m}", output: "(code-{m})*{n}" }, { condition: ">={m}", output: "0" }]
    },
    {
        id: 3.4,
        name: '超过m次，超过部分每次加n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'add',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: ">{m}", output: "(code-{m})*{n}" }, { condition: "<={m}", output: "0" }]
    },
    {
        id: 3.5,
        name: '超过m次，超过部分每次扣n分',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: ">{m}", output: "({m}-code)*{n}" }, { condition: "<={m}", output: "0" }]
    },
    {
        id: 3.6,
        name: '低于m次 扣该项基础分%n',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: "<{m}", output: "-{n}*0.01*base_score" }, { condition: ">={m}", output: "0" }]
    },
    {
        id: 3.7,
        name: '超过m次 扣该项基础分%n',
        allowAttributeCodeTypes: ["int", "integer"],
        operate: 'sub',
        inputs: [{ type: "int", code: "m", value: null }, { type: "double", code: "n", value: null }],
        rules: [{ condition: ">{m}", output: "-{n}*0.01*base_score" }, { condition: "<={m}", output: "0" }]
    },
    // case 4：完成率
    {
        id: 4,
        name: '完成率每低%1扣n分',
        allowAttributeCodeTypes: ["double", "number", "float"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: "<1", output: "-(1-code)*100*{n}" }, { condition: ">=1", output: "0" }]
    },
    {
        id: 4.1,
        name: '完成率每低%1扣该项基础分%n',
        allowAttributeCodeTypes: ["double", "number", "float"],
        operate: 'sub',
        inputs: [{ type: "double", code: "n", value: null }],
        rules: [{ condition: "<1", output: "-(1-code)*100*{n}*0.01*base_score" }, { condition: ">=1", output: "0" }]
    },
    // case 5: 主观评分
    {
        id: 5,
        name: 'A不扣分，B扣m分，C扣n分，D扣i分',
        allowAttributeCodeTypes: ["string", "text"],
        operate: 'sub',
        inputs: [{ type: "double", code: "m", value: 5 }, { type: "double", code: "n", value: 10 }, { type: "double", code: "i", value: 15 }],
        rules: [{ condition: '"A"', output: "0" }, { condition: '"B"', output: "-{m}" }, { condition: '"C"', output: "-{n}" }, { condition: '"D"', output: "-{i}" }]
    },
    {
        id: 5.1,
        name: '主观评分',
        allowAttributeCodeTypes: ["int", "integer", "double", "number", "float"],
        operate: 'sub',
        inputs: [],
        rules: [{ condition: '', output: "code-base_score" }]
    }
]

DmnXml.getXmlByFormula = function (oldXml, attributeCode, formulaItem, inputs) {
    return DmnXmlFormula.getXml(oldXml, attributeCode, formulaItem, inputs)
}

class DmnXmlFormula {
    static getXml(oldXml, attributeCode, formulaItem, inputs) {
        let xmlDoc = loadXmlString(oldXml)

        let decisionNode = this._findDecisionNodeByAttributeCode(xmlDoc, attributeCode)
        if (!decisionNode) {
            return oldXml
        }

        let parsedRules = this._rulesParsed(formulaItem.rules, attributeCode, inputs)

        this._createRules(xmlDoc, decisionNode, parsedRules)

        let newXml = xmlDomToString(xmlDoc)
        return newXml.replace(/xmlns=""/g, '')
    }

    // 获取该code对应的Decision 只取命中的第一个
    static _findDecisionNodeByAttributeCode(xmlDoc, attributeCode) {
        let decisionNodes = xmlDoc.getElementsByTagName('decision')
        for (let i = 0; i < decisionNodes.length; i++) {
            let item = DmnXmlTemplate._parseDecision(decisionNodes.item(i), [attributeCode])
            if (item.codes.length) {
                return decisionNodes.item(i)
            }
        }
        return null
    }

    // 根据inputs,对预定义的变量赋值
    static _rulesParsed(rules, attributeCode, inputs) {
        let parsedRules = []
        for (let k in rules) {
            let output = rules[k].output
            let condition = rules[k].condition
            for (let kk in inputs) {
                condition = condition.replaceAll('{' + inputs[kk].code + '}', inputs[kk].value)
                output = output.replaceAll('{' + inputs[kk].code + '}', inputs[kk].value)
            }
            output = output.replaceAll('code', attributeCode)

            parsedRules.push({
                condition: condition,
                output: output
            })
        }
        return parsedRules
    }

    // 写入规则 只支持一个decision对应一个input
    static _createRules(xmlDoc, decisionNode, parsedRules) {
        let random = Math.random().toString(36).slice(2)

        let decisionTable = decisionNode.getElementsByTagName('decisionTable').item(0)

        // 移除存在的rule节点
        let oldRules = decisionTable.getElementsByTagName('rule')
        while (oldRules.length) {
            oldRules.item(0).remove()
        }

        for (let k in parsedRules) {
            let idSuffix = random + k

            let ruleNode = xmlDoc.createElement('rule')
            ruleNode.setAttribute('id', "DecisionRule_" + idSuffix)
            // inputEntry
            let inputEntry = xmlDoc.createElement('inputEntry')
            inputEntry.setAttribute('id', "UnaryTests_" + idSuffix)
            let inputText = xmlDoc.createElement('text')
            inputText.appendChild(xmlDoc.createTextNode(parsedRules[k].condition))
            inputEntry.appendChild(inputText) // text
            ruleNode.appendChild(inputEntry)
            // outputEntry
            let outputEntry = xmlDoc.createElement('outputEntry')
            outputEntry.setAttribute('id', "LiteralExpression_" + idSuffix)
            let outputText = xmlDoc.createElement('text')
            outputText.appendChild(xmlDoc.createTextNode(parsedRules[k].output))
            outputEntry.appendChild(outputText) // text
            ruleNode.appendChild(outputEntry)
            // append
            decisionTable.appendChild(ruleNode)
        }
    }
}