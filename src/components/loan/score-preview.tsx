
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ScoringParameter } from '@/lib/types';

interface ScorePreviewProps {
  parameters: ScoringParameter[];
}

const evaluateCondition = (inputValue: string | number, condition: string, ruleValue: string): boolean => {
    if (inputValue === undefined) return false;
    
    const numericInputValue = typeof inputValue === 'string' ? parseFloat(inputValue) : inputValue;
    const isNumericComparison = !isNaN(numericInputValue) && !isNaN(parseFloat(ruleValue.split('-')[0]));
    
    if (isNumericComparison) {
        if (condition === 'between') {
            const [min, max] = ruleValue.split('-').map(parseFloat);
            if (isNaN(min) || isNaN(max)) return false;
            return numericInputValue >= min && numericInputValue <= max;
        }

        const numericRuleValue = parseFloat(ruleValue);
        if (isNaN(numericRuleValue)) return false;

        switch (condition) {
            case '>': return numericInputValue > numericRuleValue;
            case '<': return numericInputValue < numericRuleValue;
            case '>=': return numericInputValue >= numericRuleValue;
            case '<=': return numericInputValue <= numericRuleValue;
            case '==': return numericInputValue == numericRuleValue;
            case '!=': return numericInputValue != numericRuleValue;
            default: return false;
        }
    } else {
         switch (condition) {
            case '==': return String(inputValue).toLowerCase() == ruleValue.toLowerCase();
            case '!=': return String(inputValue).toLowerCase() != ruleValue.toLowerCase();
            default: return false;
        }
    }
};

export function ScorePreview({ parameters }: ScorePreviewProps) {
  const [applicantData, setApplicantData] = useState<Record<string, string>>({});
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null);

  const uniqueFields = useMemo(() => {
    const fields = new Map<string, { type: 'number' | 'select', options: Set<string> }>();
    parameters.forEach(param => {
      param.rules.forEach(rule => {
        if (rule.field) {
            if (!fields.has(rule.field)) {
                 fields.set(rule.field, { type: 'number', options: new Set() });
            }
            
            const fieldInfo = fields.get(rule.field)!;
            const isRuleValueNumeric = !isNaN(parseFloat(rule.value.split('-')[0]));
            
            // If the rule value is not a number, it must be a dropdown option
            if (!isRuleValueNumeric) {
                fieldInfo.type = 'select';
                // Add all non-numeric values to the dropdown options
                if (rule.condition === '==' || rule.condition === '!=') {
                    fieldInfo.options.add(rule.value);
                }
            }
        }
      });
    });
    return Array.from(fields.entries()).map(([name, info]) => ({ 
        name, 
        type: info.type,
        options: Array.from(info.options) 
    }));
  }, [parameters]);

  const handleInputChange = (field: string, value: string) => {
    setApplicantData(prev => ({ ...prev, [field]: value }));
    setCalculatedScore(null); // Reset score when data changes
  };

  const handleCalculateScore = () => {
    let totalWeightedScore = 0;
    
    parameters.forEach(param => {
        let maxScoreForParam = 0;
        param.rules.forEach(rule => {
            const inputValue = applicantData[rule.field];
            if (inputValue !== undefined) {
                 if (evaluateCondition(inputValue, rule.condition, rule.value)) {
                    if (rule.score > maxScoreForParam) {
                        maxScoreForParam = rule.score;
                    }
                }
            }
        });
        totalWeightedScore += maxScoreForParam * (param.weight / 100);
    });

    setCalculatedScore(totalWeightedScore);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview Score Calculation</CardTitle>
        <CardDescription>
          Enter sample applicant data to see the calculated score based on the current rules and weights.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {uniqueFields.map(field => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={`preview-${field.name}`} className="capitalize">{field.name.replace(/([A-Z])/g, ' $1')}</Label>
              {field.type === 'select' ? (
                <Select onValueChange={(value) => handleInputChange(field.name, value)} value={applicantData[field.name] || ''}>
                  <SelectTrigger id={`preview-${field.name}`}>
                    <SelectValue placeholder={`Select ${field.name}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.filter(Boolean).map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`preview-${field.name}`}
                  type="number"
                  value={applicantData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={`Enter ${field.name}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
            <Button onClick={handleCalculateScore}>Calculate Score</Button>
            {calculatedScore !== null && (
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Calculated Weighted Score</p>
                    <p className="text-3xl font-bold">{calculatedScore.toFixed(0)}</p>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
