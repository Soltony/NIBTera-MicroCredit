
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PlusCircle, Trash2, Save } from 'lucide-react';
import { useScoringRules, type Rule, type ScoringParameter } from '@/hooks/use-scoring-rules';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScorePreview } from '@/components/loan/score-preview';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLoanProviders } from '@/hooks/use-loan-providers';

const RuleRow = ({ rule, onUpdate, onRemove, color }: { rule: Rule; onUpdate: (updatedRule: Rule) => void; onRemove: () => void; color?: string; }) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Input 
                placeholder="e.g., age"
                value={rule.field}
                onChange={(e) => onUpdate({ ...rule, field: e.target.value })}
                className="w-1/4"
            />
             <Input 
                placeholder="e.g., >"
                value={rule.condition}
                onChange={(e) => onUpdate({ ...rule, condition: e.target.value })}
                className="w-1/4"
            />
            <Input 
                placeholder="e.g., 30"
                value={rule.value}
                onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                 className="w-1/4"
            />
            <Input 
                type="number"
                placeholder="Score"
                value={rule.score}
                onChange={(e) => onUpdate({ ...rule, score: parseInt(e.target.value) || 0 })}
                 className="w-1/4"
            />
            <Button variant="ghost" size="icon" onClick={onRemove} style={{ color: color }} className="hover:text-white">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};


export default function CreditScoreEnginePage() {
    const { providers } = useLoanProviders();
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const { getParametersForProvider, addParameter, updateParameter, removeParameter, addRule, updateRule, removeRule, saveParametersForProvider } = useScoringRules();
    const [deletingParameterId, setDeletingParameterId] = useState<string | null>(null);
    const { toast } = useToast();
    
    // Set initial provider once providers are loaded
    useEffect(() => {
        if (providers.length > 0 && !selectedProviderId) {
            setSelectedProviderId(providers[0].id);
        }
    }, [providers, selectedProviderId]);
    
    const selectedProvider = useMemo(() => providers.find(p => p.id === selectedProviderId), [providers, selectedProviderId]);
    const themeColor = selectedProvider?.colorHex || '#fdb913';

    const currentParameters = useMemo(() => {
        if (!selectedProviderId) return [];
        return getParametersForProvider(selectedProviderId);
    }, [selectedProviderId, getParametersForProvider]);

    const totalWeight = React.useMemo(() => {
        return currentParameters.reduce((sum, param) => sum + param.weight, 0);
    }, [currentParameters]);

    const handleSave = () => {
        if (!selectedProviderId) return;
        if (totalWeight > 100) {
            toast({
                title: 'Invalid Configuration',
                description: 'The total weight of all parameters cannot exceed 100%.',
                variant: 'destructive',
            });
            return;
        }
        if (totalWeight < 100) {
            toast({
                title: 'Configuration Warning',
                description: `The total weight is ${totalWeight}%, which is less than 100%. The configuration is saved but may not be optimal.`,
                variant: 'default',
            });
        }
        saveParametersForProvider(selectedProviderId, currentParameters);
        toast({
            title: 'Configuration Saved',
            description: 'Your credit scoring engine parameters have been successfully saved.',
        });
    };
    
    const handleUpdateParameter = (paramId: string, updatedData: Partial<ScoringParameter>) => {
        const paramToUpdate = currentParameters.find(p => p.id === paramId);
        if (paramToUpdate) {
            updateParameter(selectedProviderId, paramId, { ...paramToUpdate, ...updatedData });
        }
    };

    if (!selectedProviderId) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                <p className="text-muted-foreground">Loading providers...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                    <p className="text-muted-foreground">
                        Define the parameters and rules used to calculate customer credit scores.
                    </p>
                </div>
                 <div className="flex items-center space-x-4">
                     <Select onValueChange={setSelectedProviderId} value={selectedProviderId}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {providers.map(provider => (
                                <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Total Weight:</span>
                        <span className={`text-lg font-bold ${totalWeight > 100 ? 'text-red-500' : ''}`}>
                            {totalWeight}%
                        </span>
                    </div>
                    <Button onClick={handleSave} style={{ backgroundColor: themeColor }} className="text-white">
                        <Save className="mr-2 h-4 w-4" /> Save Configuration
                    </Button>
                    <Button onClick={() => addParameter(selectedProviderId)} style={{ backgroundColor: themeColor }} className="text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Parameter
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {currentParameters.map((param) => (
                    <Card key={param.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4 w-full">
                                <Input 
                                    placeholder="Parameter Name"
                                    value={param.name}
                                    onChange={(e) => handleUpdateParameter(param.id, { name: e.target.value })}
                                    className="text-lg font-semibold w-1/3"
                                />
                                <div className="flex items-center gap-2">
                                     <Label>Weight:</Label>
                                     <Input 
                                        type="number"
                                        placeholder="%"
                                        value={param.weight}
                                        onChange={(e) => handleUpdateParameter(param.id, { weight: parseInt(e.target.value) || 0 })}
                                        className="w-20"
                                    />
                                </div>
                            </div>
                             <AlertDialog open={deletingParameterId === param.id} onOpenChange={(isOpen) => !isOpen && setDeletingParameterId(null)}>
                                <AlertDialogTrigger asChild>
                                    <Button 
                                        variant="destructive" 
                                        size="icon" 
                                        onClick={() => setDeletingParameterId(param.id)}
                                        style={{ backgroundColor: themeColor }}
                                        className="text-white"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the &quot;{param.name}&quot; parameter and all of its rules.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => removeParameter(selectedProviderId, param.id)} style={{ backgroundColor: themeColor }} className="text-white">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible>
                                <AccordionItem value="rules">
                                    <AccordionTrigger>Manage Rules</AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                                            <Label className="w-1/4">Field</Label>
                                            <Label className="w-1/4">Condition</Label>
                                            <Label className="w-1/4">Value</Label>
                                            <Label className="w-1/4">Score</Label>
                                        </div>
                                        {param.rules.map((rule) => (
                                           <RuleRow 
                                                key={rule.id}
                                                rule={rule}
                                                onUpdate={(updatedRule) => updateRule(selectedProviderId, param.id, rule.id, updatedRule)}
                                                onRemove={() => removeRule(selectedProviderId, param.id, rule.id)}
                                                color={themeColor}
                                           />
                                        ))}
                                         <Button 
                                            variant="outline" 
                                            className="mt-2 w-full text-white" 
                                            onClick={() => addRule(selectedProviderId, param.id)}
                                            style={{ backgroundColor: themeColor }}
                                         >
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                                        </Button>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                ))}
            </div>
             <ScorePreview parameters={currentParameters} />
        </div>
    );
}
