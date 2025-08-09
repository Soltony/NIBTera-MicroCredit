
'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScoringParameters, type GenderImpact } from '@/hooks/use-scoring-parameters';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const ParameterSlider = ({ label, value, onValueChange }: { label: string; value: number; onValueChange: (value: number[]) => void; }) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-medium">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={onValueChange}
        max={100}
        step={1}
      />
    </div>
  );
};

const GenderImpactSelector = ({ label, value, onValueChange }: { label: string; value: GenderImpact; onValueChange: (value: GenderImpact) => void; }) => {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Select impact" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="no_impact">No Impact</SelectItem>
                    <SelectItem value="slight_positive">Slight Positive</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="slight_negative">Slight Negative</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

export default function ScoringEnginePage() {
  const { parameters, updateParameter, setGenderImpact, setOccupationRisk, addOccupation, removeOccupation, resetParameters } = useScoringParameters();
  const { toast } = useToast();
  const [newOccupation, setNewOccupation] = React.useState('');

  const handleSave = () => {
    // The hook already saves on change, but we can add a toast for user feedback
    toast({
      title: 'Parameters Saved',
      description: 'Your credit scoring parameters have been updated.',
    });
  };

  const handleAddOccupation = () => {
    if (newOccupation.trim()) {
      addOccupation(newOccupation.trim());
      setNewOccupation('');
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
        <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={resetParameters}>Reset to Defaults</Button>
            <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      </div>
      <p className="text-muted-foreground">
        Configure the parameters and weights used to calculate customer credit scores. The total of all weights should ideally be 100%.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Demographics</CardTitle>
            <CardDescription>Weights for user demographic data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <GenderImpactSelector
                label="Male Impact"
                value={parameters.genderImpact.male}
                onValueChange={(v) => setGenderImpact('male', v)}
            />
             <GenderImpactSelector
                label="Female Impact"
                value={parameters.genderImpact.female}
                onValueChange={(v) => setGenderImpact('female', v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial History</CardTitle>
            <CardDescription>Weights for financial and loan history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ParameterSlider
              label="Transaction History (Total)"
              value={parameters.weights.transactionHistoryTotal}
              onValueChange={(v) => updateParameter('transactionHistoryTotal', v[0])}
            />
            <ParameterSlider
              label="Transaction History (by Product)"
              value={parameters.weights.transactionHistoryByProduct}
              onValueChange={(v) => updateParameter('transactionHistoryByProduct', v[0])}
            />
            <ParameterSlider
              label="Loan History (Count)"
              value={parameters.weights.loanHistoryCount}
              onValueChange={(v) => updateParameter('loanHistoryCount', v[0])}
            />
             <ParameterSlider
              label="On-Time Repayments"
              value={parameters.weights.onTimeRepayments}
              onValueChange={(v) => updateParameter('onTimeRepayments', v[0])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment & Income</CardTitle>
            <CardDescription>Weights for employment and salary information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ParameterSlider
              label="Salary"
              value={parameters.weights.salary}
              onValueChange={(v) => updateParameter('salary', v[0])}
            />
             <div className="space-y-2">
                <Label>Occupation Risk Levels</Label>
                 <div className="flex space-x-2">
                    <Input 
                        value={newOccupation}
                        onChange={(e) => setNewOccupation(e.target.value)}
                        placeholder="e.g., Engineer"
                    />
                    <Button onClick={handleAddOccupation}>Add</Button>
                </div>
                <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                    {Object.entries(parameters.occupationRisk).map(([occupation, risk]) => (
                        <div key={occupation} className="flex items-center justify-between space-x-2">
                            <span className="capitalize text-sm flex-1">{occupation}</span>
                             <Select value={risk} onValueChange={(v) => setOccupationRisk(occupation, v as 'Low' | 'Medium' | 'High')}>
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Risk" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOccupation(occupation)}>
                                &times;
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
