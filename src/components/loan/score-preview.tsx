
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ScoringParameter } from '@/lib/types';
import { evaluateCondition } from '@/lib/utils';

interface ScorePreviewProps {
  parameters: ScoringParameter[];
  availableFields: { value: string; label: string; type?: 'select', options?: string[] }[];
  providerColor?: string;
}

export function ScorePreview({ parameters, availableFields, providerColor = '#fdb913' }: ScorePreviewProps) {
  const [applicantData, setApplicantData] = useState<Record<string, string>>({});
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null);

  const uniqueFields = useMemo(() => {
    const fieldsInUse = new Set<string>();
    parameters.forEach(param => {
      param.rules.forEach(rule => {
        fieldsInUse.add(rule.field);
      });
    });

    return availableFields.filter(field => fieldsInUse.has(field.value));
  }, [parameters, availableFields]);

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
  
  const getFieldInfo = (fieldName: string) => {
      return availableFields.find(f => f.value === fieldName);
  }

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
          {uniqueFields.map(field => {
            const fieldInfo = getFieldInfo(field.value);
            return (
                <div key={field.value} className="space-y-2">
                  <Label htmlFor={`preview-${field.value}`} className="capitalize">{field.label}</Label>
                  {fieldInfo?.type === 'select' ? (
                    <Select onValueChange={(value) => handleInputChange(field.value, value)} value={applicantData[field.value] || ''}>
                      <SelectTrigger id={`preview-${field.value}`}>
                        <SelectValue placeholder={`Select ${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldInfo.options?.filter(Boolean).map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`preview-${field.value}`}
                      type="number"
                      value={applicantData[field.value] || ''}
                      onChange={(e) => handleInputChange(field.value, e.target.value)}
                      placeholder={`Enter ${field.label}`}
                    />
                  )}
                </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between">
            <Button onClick={handleCalculateScore} style={{ backgroundColor: providerColor }} className="text-white">Calculate Score</Button>
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
