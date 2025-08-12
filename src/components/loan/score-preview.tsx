
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ScoringParameter } from '@/lib/types';

interface ScorePreviewProps {
  parameters: ScoringParameter[];
}

const evaluateCondition = (inputValue: number, condition: string, ruleValue: string): boolean => {
    if (condition === 'between') {
        const [min, max] = ruleValue.split('-').map(parseFloat);
        if (isNaN(min) || isNaN(max)) return false;
        return inputValue >= min && inputValue <= max;
    }

    const numericRuleValue = parseFloat(ruleValue);
    if (isNaN(numericRuleValue)) return false;

    switch (condition) {
        case '>': return inputValue > numericRuleValue;
        case '<': return inputValue < numericRuleValue;
        case '>=': return inputValue >= numericRuleValue;
        case '<=': return inputValue <= numericRuleValue;
        case '==': return inputValue === numericRuleValue;
        case '!=': return inputValue !== numericRuleValue;
        default: return false;
    }
};

export function ScorePreview({ parameters }: ScorePreviewProps) {
  const [applicantData, setApplicantData] = useState<Record<string, string>>({});
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null);

  const uniqueFields = useMemo(() => {
    const fields = new Set<string>();
    parameters.forEach(param => {
      param.rules.forEach(rule => {
        if(rule.field) fields.add(rule.field);
      });
    });
    return Array.from(fields);
  }, [parameters]);

  const handleInputChange = (field: string, value: string) => {
    setApplicantData(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculateScore = () => {
    let totalScore = 0;
    
    parameters.forEach(param => {
        let maxScoreForParam = 0;
        param.rules.forEach(rule => {
            const inputValue = parseFloat(applicantData[rule.field]);
            if (!isNaN(inputValue)) {
                 if (evaluateCondition(inputValue, rule.condition, rule.value)) {
                    // Find the highest score among matching rules for this parameter
                    if (rule.score > maxScoreForParam) {
                        maxScoreForParam = rule.score;
                    }
                }
            }
        });
        
        // Apply weight to the highest score found for the parameter
        totalScore += maxScoreForParam * (param.weight / 100);
    });

    setCalculatedScore(totalScore);
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
            <div key={field} className="space-y-2">
              <Label htmlFor={`preview-${field}`} className="capitalize">{field.replace(/([A-Z])/g, ' $1')}</Label>
              <Input
                id={`preview-${field}`}
                type="number"
                value={applicantData[field] || ''}
                onChange={(e) => handleInputChange(field, e.target.value)}
                placeholder={`Enter ${field}`}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
            <Button onClick={handleCalculateScore}>Calculate Score</Button>
            {calculatedScore !== null && (
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Calculated Credit Score</p>
                    <p className="text-3xl font-bold">{calculatedScore.toFixed(2)}</p>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
