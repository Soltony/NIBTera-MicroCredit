
'use client';

import React, { useMemo } from 'react';
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
import { useScoringParameters, type ScoringParameters } from '@/hooks/use-scoring-parameters';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const ParameterToggle = ({ label, isChecked, onCheckedChange }: { label: string; isChecked: boolean; onCheckedChange: (checked: boolean) => void }) => (
    <div className="flex items-center justify-between space-x-2 pb-4 border-b">
        <Label htmlFor={`${label}-switch`} className="font-medium capitalize">{label.replace(/([A-Z])/g, ' $1')}</Label>
        <Switch
            id={`${label}-switch`}
            checked={isChecked}
            onCheckedChange={onCheckedChange}
        />
    </div>
);

const ParameterSlider = ({ label, value, onValueChange, isEnabled }: { label: string; value: number; onValueChange: (value: number[]) => void; isEnabled: boolean; }) => {
  if (!isEnabled) return null;
  return (
    <div className="space-y-2 pt-4">
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

const GenderImpactInput = ({ label, value, onValueChange }: { label: string; value: number; onValueChange: (event: React.ChangeEvent<HTMLInputElement>) => void; }) => {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input
                type="number"
                value={value}
                onChange={onValueChange}
                placeholder="Enter impact value"
            />
        </div>
    );
}

export default function ScoringEnginePage() {
  const { parameters, updateParameter, setGenderImpact, setGenderImpactEnabled, setOccupationRisk, addOccupation, removeOccupation, resetParameters, toggleParameterEnabled } = useScoringParameters();
  const { toast } = useToast();
  const [newOccupation, setNewOccupation] = React.useState('');

  const totalWeight = useMemo(() => {
    return Object.values(parameters.weights).reduce((sum, param) => {
        return param.enabled ? sum + param.value : sum;
    }, 0);
  }, [parameters.weights]);

  const handleSave = () => {
    if (totalWeight !== 100) {
        toast({
            title: 'Invalid Configuration',
            description: 'The total weight of all enabled parameters must be exactly 100%.',
            variant: 'destructive',
        });
        return;
    }
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
            <div className="flex items-center space-x-2 mr-4">
                <span className="text-sm font-medium">Total Weight:</span>
                <span className={cn("text-lg font-bold", totalWeight === 100 ? 'text-green-600' : 'text-red-600')}>
                    {totalWeight}%
                </span>
            </div>
            <Button variant="outline" onClick={resetParameters}>Reset to Defaults</Button>
            <Button onClick={handleSave} disabled={totalWeight !== 100}>Save Configuration</Button>
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
            <div>
                <ParameterToggle
                    label="Age"
                    isChecked={parameters.weights.age.enabled}
                    onCheckedChange={() => toggleParameterEnabled('weights', 'age')}
                />
                <ParameterSlider
                  label="Weight"
                  value={parameters.weights.age.value}
                  onValueChange={(v) => updateParameter('age', v[0])}
                  isEnabled={parameters.weights.age.enabled}
                />
            </div>
            <Separator />
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="gender-factor-switch" className="font-medium">Factor in Gender</Label>
              <Switch
                id="gender-factor-switch"
                checked={parameters.genderImpact.enabled}
                onCheckedChange={setGenderImpactEnabled}
              />
            </div>
             {parameters.genderImpact.enabled && (
              <>
                <Separator />
                <div className="pt-4 space-y-4">
                    <GenderImpactInput
                        label="Male Impact"
                        value={parameters.genderImpact.male}
                        onValueChange={(e) => setGenderImpact('male', parseFloat(e.target.value) || 0)}
                    />
                    <GenderImpactInput
                        label="Female Impact"
                        value={parameters.genderImpact.female}
                        onValueChange={(e) => setGenderImpact('female', parseFloat(e.target.value) || 0)}
                    />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial History</CardTitle>
            <CardDescription>Weights for financial and loan history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             {Object.entries(parameters.weights).filter(([key]) => ['transactionHistoryTotal', 'transactionHistoryByProduct', 'loanHistoryCount', 'onTimeRepayments'].includes(key)).map(([key, param]) => (
                <div key={key}>
                    <ParameterToggle
                        label={key}
                        isChecked={param.enabled}
                        onCheckedChange={() => toggleParameterEnabled('weights', key as keyof ScoringParameters['weights'])}
                    />
                    <ParameterSlider
                      label="Weight"
                      value={param.value}
                      onValueChange={(v) => updateParameter(key as keyof ScoringParameters['weights'], v[0])}
                      isEnabled={param.enabled}
                    />
                </div>
             ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment & Income</CardTitle>
            <CardDescription>Weights for employment and salary information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div>
                <ParameterToggle
                    label="Salary"
                    isChecked={parameters.weights.salary.enabled}
                    onCheckedChange={() => toggleParameterEnabled('weights', 'salary')}
                />
                <ParameterSlider
                  label="Weight"
                  value={parameters.weights.salary.value}
                  onValueChange={(v) => updateParameter('salary', v[0])}
                  isEnabled={parameters.weights.salary.enabled}
                />
            </div>

            <Separator/>
            
            <div>
                 <ParameterToggle
                    label="Occupation Risk"
                    isChecked={parameters.occupationRisk.enabled}
                    onCheckedChange={() => toggleParameterEnabled('occupationRisk', 'values')}
                />
                {parameters.occupationRisk.enabled && (
                    <div className="space-y-2 pt-4">
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
                            {Object.entries(parameters.occupationRisk.values).map(([occupation, risk]) => (
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
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
